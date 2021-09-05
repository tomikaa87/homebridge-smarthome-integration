import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

import { CategoryLogger } from './CategoryLogger';

export class BedroomTempSensorAccessory {
    private readonly service: Service;
    private readonly mqttClient: mqtt.Client;
    private readonly log: CategoryLogger;

    private states = {
      currentTemperature: 25,
    };

    constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: PlatformConfig,
    ) {
      this.log = new CategoryLogger(this.platform.log, 'BedroomTempSensor');

      this.log.info(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
      this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);

      this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
      this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

      this.service = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'BedroomTempSensor')
        || this.accessory.addService(this.platform.Service.TemperatureSensor, 'BedroomTempSensor', 'BedroomTempSensor');

      this.setupTemperatureSensorService();
    }

    setupTemperatureSensorService(): void {
      this.service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

      this.service.addOptionalCharacteristic(this.platform.Characteristic.Active);
      this.service.setCharacteristic(this.platform.Characteristic.Active, true);

      this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this));
    }

    subscribeToMqttTopics(): void {
      this.log.info('subscribeToMqttTopics');
      this.mqttClient.subscribe('smc/temp/current');
    }

    handleIncomingMqttMessage(topic: string, payload: Buffer): void {
      this.log.info(`handleIncomingMqttMessage: topic=${topic}, packet=${payload.toString()}`);

      if (topic.toLowerCase() === 'smc/temp/current') {
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