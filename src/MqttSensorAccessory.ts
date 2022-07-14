import { PlatformAccessory, Service, WithUUID } from 'homebridge';
import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';
import * as mqtt from 'mqtt';

export type SensorValueConversionFunction = (value: number) => number;

export abstract class MqttSensorAccessory {
  protected readonly log: CategoryLogger;
  protected readonly topic: string;
  protected readonly service: Service;

  protected states = {
    currentValue: 0,
  };

  constructor(
    serviceType: WithUUID<typeof Service>,
    topic: string,
    protected readonly platform: SmartHomeIntegrationPlatform,
    protected readonly accessory: PlatformAccessory,
    private readonly mqttClient: mqtt.Client,
    private readonly converter: SensorValueConversionFunction,
  ) {
    this.log = new CategoryLogger(
      this.platform.log,
      `MqttSensor(${this.accessory.context.device.displayName})`,
    );

    this.topic = topic.toLowerCase();

    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

    this.service = this.accessory.getServiceById(
      serviceType,
      this.accessory.context.device.displayName,
    ) || this.accessory.addService(
      serviceType,
      this.accessory.context.device.displayName,
      this.accessory.context.device.displayName,
    );

    this.service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    this.service.addOptionalCharacteristic(this.platform.Characteristic.Active);
    this.service.setCharacteristic(this.platform.Characteristic.Active, true);

    this.setupService();
  }

  protected abstract setupService(): void;
  protected abstract currentValueUpdated(): void;

  private subscribeToMqttTopics(): void {
    this.log.debug(`subscribeToMqttTopics: topic=${this.topic}`);
    this.mqttClient.subscribe(this.topic);
  }

  private handleIncomingMqttMessage(topic: string, payload: Buffer): void {
    if (topic.toLowerCase() === this.topic) {
      this.log.debug(`handleIncomingMqttMessage: topic=${topic}, payload=${payload.toString()}`);

      const parsed = Number.parseFloat(payload.toString());

      if (!isNaN(parsed) && parsed >= -100 && parsed <= 100) {
        const convertedValue = this.converter(parsed);

        if (convertedValue !== this.states.currentValue) {
          this.states.currentValue = convertedValue;

          this.log.debug(`handleIncomingMqttMessage: currentValue=${this.states.currentValue}`);

          this.currentValueUpdated();
        }
      } else {
        this.log.warn('handleIncomingMqttMessage: payload is not a number');
      }
    }
  }
}