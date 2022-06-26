import { CategoryLogger } from './CategoryLogger';
import { SmartHomeIntegrationPlatform } from './platform';
import * as mqtt from 'mqtt';
import { PlatformAccessory, Service } from 'homebridge';

export type HumidityConversionFunction = (value: number) => number;

export class MqttHumiditySensorAccessory {
  private readonly log: CategoryLogger;
  private readonly topic: string;
  private readonly service: Service;

  private states = {
    currentRelativeHumidity: 0,
  };

  constructor(
    topic: string,
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly mqttClient: mqtt.Client,
    private readonly converter: HumidityConversionFunction,
  ) {
    this.log = new CategoryLogger(
      this.platform.log,
      `MqttHumiditySensor(${this.accessory.context.device.displayName})`,
    );

    this.topic = topic.toLowerCase();

    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomingMqttMessage.bind(this));

    this.service = this.accessory.getServiceById(
      this.platform.Service.HumiditySensor,
      this.accessory.context.device.displayName,
    ) || this.accessory.addService(
      this.platform.Service.HumiditySensor,
      this.accessory.context.device.displayName,
      this.accessory.context.device.displayName,
    );
  }

  setupService(): void {
    this.service.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    this.service.addOptionalCharacteristic(this.platform.Characteristic.Active);
    this.service.setCharacteristic(this.platform.Characteristic.Active, true);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(async () => {
        return this.states.currentRelativeHumidity;
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
        this.states.currentRelativeHumidity = this.converter(parsed);

        this.log.info(`handleIncomingMqttMessage: currentRelativeHumidity=${this.states.currentRelativeHumidity}`);

        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentRelativeHumidity,
          this.states.currentRelativeHumidity,
        );
      } else {
        this.log.warn('handleIncomingMqttMessage: payload is not a number');
      }
    }
  }
}