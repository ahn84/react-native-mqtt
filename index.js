import {
  NativeEventEmitter,
  NativeModules
} from 'react-native';

var Mqtt = NativeModules.Mqtt;

var MqttClient = function(options, clientRef){
  this.options = options;
  this.clientRef = clientRef;
  this.eventHandler = {};

  this.dispatchEvent = function(data) {

    if(data && data.clientRef == this.clientRef && data.event) {

      if(this.eventHandler[data.event]) {
        this.eventHandler[data.event](data.message);
      }
    }
  }
}

MqttClient.prototype.on = function (event, callback) {
  console.log('setup event', event);
  this.eventHandler[event] = callback;
}

MqttClient.prototype.connect = function () {
  Mqtt.connect(this.clientRef);
}

MqttClient.prototype.reconnect = function () {
  Mqtt.reconnect(this.clientRef);
}

MqttClient.prototype.isConnected = async function () {
  let ret = await Mqtt.isConnected(this.clientRef);
  return ret;
}

MqttClient.prototype.disconnect = function () {
  Mqtt.disconnect(this.clientRef);
}

MqttClient.prototype.subscribe = function (topic, qos) {
  Mqtt.subscribe(this.clientRef, topic, qos);
}

MqttClient.prototype.unsubscribe = function (topic) {
  Mqtt.unsubscribe(this.clientRef, topic);
}

MqttClient.prototype.publish = function(topic, payload, qos, retain) {
  Mqtt.publish(this.clientRef, topic, payload, qos, retain);
}

const emitter = new NativeEventEmitter(Mqtt);

module.exports = {
  clients: [],
  eventHandler: null,
  dispatchEvents: function(data) {
    this.clients.forEach(function(client) {
      client.dispatchEvent(data);
    });
  },
  setEventHandler: function() {
    this.eventHandler = emitter.addListener("mqtt_events", (data) =>
      this.dispatchEvents(data));
  },
  createClient: async function(options) {
    if(options.uri) {
      var pattern = /^((mqtt[s]?|ws[s]?)?:(\/\/)([0-9a-zA-Z_\-\.]*):?(\d+))$/;
      var matches = options.uri.match(pattern);
      var protocol = matches[2];
      var host = matches[4];
      var port =  matches[5];

      options.port = parseInt(port);
      options.host = host;
      options.protocol = 'tcp';


      if(protocol == 'wss' || protocol == 'mqtts') {
        options.tls = true;
      }
      if(protocol == 'ws' || protocol == 'wss') {
        options.protocol = 'ws';
      }

    }

    let clientRef = await Mqtt.createClient(options);

    var client = new MqttClient(options, clientRef);

    /* Listen mqtt event */
    if(this.eventHandler === null) {
      this.setEventHandler();
    }
    this.clients.push(client);

    return client;
  },
  removeClient: function(client) {
    Mqtt.removeClient(client.clientRef)
      .then(() => {
        var clientIdx = this.clients.indexOf(client);

        if (clientIdx > -1){
          this.clients.splice(clientIdx, 1);
        }
        if (this.clients.length > 0) {
          if (this.eventHandler !== null) {
            this.eventHandler.remove();
            this.setEventHandler();
          }
        }
      });
  }
};
