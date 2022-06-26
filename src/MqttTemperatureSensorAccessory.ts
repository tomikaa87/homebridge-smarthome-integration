import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';
import * as mqtt from 'mqtt';
import { PlatformAccessory, Service } from 'homebridge';

export type TemperatureConversionFunction = (value: number) => number;

export class MqttTemperatureSensorAccessory {
  private readonly log: CategoryLogger;
  private readonly topic: string;
  private readonly service: Service;

  private states = {
    currentTemperature: 0,
  };

  constructor(
    topic: string,
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly mqttClient: mqtt.Client,
    private readonly converter: TemperatureConversionFunction,
  ) {
    this.log = new CategoryLogger(
      this.platform.log,
      `MqttTemperatureSensor(${this.accessory.context.device.displayName})`,
    );

    this.topic = topic.toLowerCase();

    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

    this.service = this.accessory.getServiceById(
      this.platform.Service.TemperatureSensor,
      this.accessory.context.device.displayName,
    ) || this.accessory.addService(
      this.platform.Service.TemperatureSensor,
      this.accessory.context.device.displayName,
      this.accessory.context.device.displayName,
    );
  }

  setupService(): void {
    this.service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    this.service.addOptionalCharacteristic(this.platform.Characteristic.Active);
    this.service.setCharacteristic(this.platform.Characteristic.Active, true);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(async () => {
        return this.states.currentTemperature;
      });
  }

  subscribeToMqttTopics(): void {
    this.log.info(`subscribeToMqttTopics: topic=${this.topic}`);
    this.mqttClient.subscribe(this.topic);
  }

  handleIncomingMqttMessage(topic: string, payload: Buffer): void {
    if (topic.toLowerCase() === this.topic) {
      this.log.info(`handleIncomingMqttMessage: topic=${topic}, payload=${payload.toString()}`);

      const parsed = Number.parseFloat(payload.toString());

      if (!isNaN(parsed) && parsed >= -100 && parsed <= 100) {
        this.states.currentTemperature = this.converter(parsed);

        this.log.info(`handleIncomingMqttMessage: currentTemperature=${this.states.currentTemperature}`);

        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.states.currentTemperature,
        );
      } else {
        this.log.warn('handleIncomingMqttMessage: payload is not a number');
      }
    }
  }
}