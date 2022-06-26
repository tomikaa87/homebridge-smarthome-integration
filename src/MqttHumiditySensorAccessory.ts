import { SmartHomeIntegrationPlatform } from './platform';
import * as mqtt from 'mqtt';
import { PlatformAccessory } from 'homebridge';
import { MqttSensorAccessory, SensorValueConversionFunction } from './MqttSensorAccessory';

export class MqttHumiditySensorAccessory extends MqttSensorAccessory {
  constructor(
    topic: string,
    platform: SmartHomeIntegrationPlatform,
    accessory: PlatformAccessory,
    mqttClient: mqtt.Client,
    converter: SensorValueConversionFunction = (value: number) => value,
  ) {
    super(
      platform.Service.HumiditySensor,
      topic,
      platform,
      accessory,
      mqttClient,
      converter,
    );
  }

  protected setupService(): void {
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(async () => {
        return this.states.currentValue;
      });
  }

  protected currentValueUpdated(): void {
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentRelativeHumidity,
      this.states.currentValue,
    );
  }
}