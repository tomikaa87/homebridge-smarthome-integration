import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

import { CategoryLogger } from './CategoryLogger';

class ShutterControl {
  private readonly log: CategoryLogger;
  private readonly service: Service;
  private readonly serviceName: string;
  private position: number;

  constructor(
    private readonly name: string,
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly mqttClient: mqtt.Client,
    private readonly mqttSubTopic: string,
  ) {
    this.serviceName = `ShutterControl-${name}`;

    this.log = new CategoryLogger(this.platform.log, this.serviceName);

    this.log.info(`Creating: name=${this.name}, mqttSubTopic=${this.mqttSubTopic}`);

    this.position = 50;

    this.service = this.accessory.getServiceById(this.platform.Service.WindowCovering, this.serviceName)
      || this.accessory.addService(this.platform.Service.WindowCovering, this.name, this.serviceName);

    this.service.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(async () => {
        return this.position;
      });

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onGet(async () => {
        return this.position;
      })
      .onSet(async (value: CharacteristicValue) => {
        this.setPosition(value as number);
      });
  }

  setPosition(pos: number): void {
    const mqttSetTopic = `home/shutters/${this.mqttSubTopic}/state/set`;

    this.log.debug(`setPosition: pos=${pos}, mqttSetTopic=${mqttSetTopic}`);

    this.position = pos;

    if (pos <= 40) {
      this.mqttClient.publish(mqttSetTopic, '0');
    } else if (pos >= 60) {
      this.mqttClient.publish(mqttSetTopic, '1');
    }
  }
}

export class ShutterControllerAccessory {
  private readonly mqttClient: mqtt.Client;
  private readonly log: CategoryLogger;
  private readonly control: ShutterControl;

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
    private readonly name: string,
    private readonly mqttSubTopic: string,
  ) {
    this.log = new CategoryLogger(this.platform.log, `ShutterControllerAccessory-${this.name}`);

    this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl, {
      username: this.config.mqttUsername,
      password: this.config.mqttPassword,
    });
    this.mqttClient.on('connect', () => {
      this.log.debug('MQTT client connected');
    });

    this.control = new ShutterControl(this.name, platform, accessory, this.mqttClient, this.mqttSubTopic);
  }
}