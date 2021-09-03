import { Service, PlatformAccessory, CharacteristicValue, Logger, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

export class BedroomTempSensorAccessory {
    private readonly service: Service;
    private readonly mqttClient: mqtt.Client;
    private readonly log: Logger;

    private states = {
      currentTemperature: 25,
    };

    constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: PlatformConfig,
    ) {
      this.log = platform.log;

      this.log.info(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
      this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);

      this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
      this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

      this.service = this.accessory.getService(this.platform.Service.TemperatureSensor)
        || this.accessory.addService(this.platform.Service.TemperatureSensor);

      this.setupTemperatureSensorService();
    }

    setupTemperatureSensorService(): void {
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

      this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this));
    }

    subscribeToMqttTopics(): void {
      this.log.info('subscribeToMqttTopics');
      this.mqttClient.subscribe('bedroom/temp/current');
    }

    handleIncomingMqttMessage(topic: string, payload: Buffer): void {
      this.log.debug(`handleIncomingMqttMessage: topic=${topic}, packet=${payload.toString()}`);

      if (topic.toLowerCase() === 'bedroom/temp/current') {
        this.states.currentTemperature = Number.parseFloat(payload.toString());
        this.log.info(`handleIncomingMqttMessage: currentTemperature=${this.states.currentTemperature}`);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.states.currentTemperature);
      }
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
      this.log.info(`getCurrentTemperature: ${this.states.currentTemperature} C`);
      return this.states.currentTemperature;
    }
}