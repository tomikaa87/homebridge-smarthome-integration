import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

import { CategoryLogger } from './CategoryLogger';

export class BabyRoomAccessory {
    private readonly tempSensorService: Service;
    private readonly humSensorService: Service;
    private readonly mqttClient: mqtt.Client;
    private readonly log: CategoryLogger;

    private states = {
      currentTemperature: 25,
      currentRelativeHumidity: 50,
    };

    constructor(
        private readonly platform: SmartHomeIntegrationPlatform,
        private readonly accessory: PlatformAccessory,
        private readonly config: PlatformConfig,
    ) {
      this.log = new CategoryLogger(this.platform.log, 'BabyRoom');

      this.log.info(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
      this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);

      this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
      this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

      this.tempSensorService = this.accessory.getServiceById(this.platform.Service.TemperatureSensor, 'BabyRoomTempSensor')
        || this.accessory.addService(this.platform.Service.TemperatureSensor, 'BabyRoomTempSensor', 'BabyRoomTempSensor');

      this.humSensorService = this.accessory.getServiceById(this.platform.Service.HumiditySensor, 'BabyRoomRhSensor')
        || this.accessory.addService(this.platform.Service.HumiditySensor, 'BabyRoomRhSensor', 'BabyRoomRhSensor');

      this.setupTemperatureSensorService();
      this.setupHumiditySensorService();
    }

    setupTemperatureSensorService(): void {
      this.tempSensorService.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.tempSensorService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

      this.tempSensorService.addOptionalCharacteristic(this.platform.Characteristic.Active);
      this.tempSensorService.setCharacteristic(this.platform.Characteristic.Active, true);

      this.tempSensorService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .onGet(this.getCurrentTemperature.bind(this));
    }

    setupHumiditySensorService(): void {
      this.humSensorService.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.humSensorService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

      this.humSensorService.addOptionalCharacteristic(this.platform.Characteristic.Active);
      this.humSensorService.setCharacteristic(this.platform.Characteristic.Active, true);

      this.humSensorService.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
        .onGet(this.getCurrentRelativeHumidity.bind(this));
    }

    subscribeToMqttTopics(): void {
      this.log.info('subscribeToMqttTopics');
      this.mqttClient.subscribe('home/temperature/baby_room');
      this.mqttClient.subscribe('home/humidity/baby_room');
    }

    handleIncomingMqttMessage(topic: string, payload: Buffer): void {
      this.log.info(`handleIncomingMqttMessage: topic=${topic}, packet=${payload.toString()}`);

      if (topic.toLowerCase() === 'home/temperature/baby_room') {
        this.states.currentTemperature = Number.parseFloat(payload.toString());

        this.log.info(`handleIncomingMqttMessage: currentTemperature=${this.states.currentTemperature}`);

        this.tempSensorService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.states.currentTemperature,
        );
      }

      if (topic.toLowerCase() === 'home/humidity/baby_room') {
        this.states.currentRelativeHumidity = Number.parseFloat(payload.toString());

        this.log.info(`handleIncomingMqttMessage: currentRelativeHumidity=${this.states.currentRelativeHumidity}`);

        this.humSensorService.updateCharacteristic(
          this.platform.Characteristic.CurrentRelativeHumidity,
          this.states.currentRelativeHumidity,
        );
      }
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
      this.log.info(`getCurrentTemperature: ${this.states.currentTemperature} C`);
      return this.states.currentTemperature;
    }

    async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
      this.log.info(`getCurrentRelativeHumidity: ${this.states.currentRelativeHumidity} %RH`);
      return this.states.currentRelativeHumidity;
    }
}