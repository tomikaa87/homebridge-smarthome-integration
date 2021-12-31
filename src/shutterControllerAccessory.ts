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
    private readonly mqttTopic: string,
  ) {
    this.serviceName = `ShutterControl-${name}`;

    this.log = new CategoryLogger(this.platform.log, this.serviceName);

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
    const mqttSetTopic = `home/shutters/${this.mqttTopic}/state/set`;

    this.log.info(`setPosition: pos=${pos}, mqttSetTopic=${mqttSetTopic}`);

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
  private readonly bedroomDoor: ShutterControl;
  private readonly bedroomWindow: ShutterControl;
  private readonly livingRoomLeftDoor: ShutterControl;
  private readonly livingRoomLeftWindow: ShutterControl;
  private readonly livingRoomRightWindow: ShutterControl;
  private readonly livingRoomRightDoor: ShutterControl;
  private readonly kitchenDoor: ShutterControl;
  private readonly kitchenLeftWindow: ShutterControl;
  private readonly kitchenRightWindow: ShutterControl;

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
  ) {
    this.log = new CategoryLogger(this.platform.log, 'ShutterControllerAccessory');

    this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);
    this.mqttClient.on('connect', () => {
      this.log.info('MQTT client connected');
    });

    this.bedroomDoor = new ShutterControl('Bedroom Door', platform, accessory, this.mqttClient, 'bedroom/door');
    this.bedroomWindow = new ShutterControl('Bedroom Window', platform, accessory, this.mqttClient, 'bedroom/window');

    this.livingRoomLeftDoor = new ShutterControl('Living Room Left Door', platform, accessory, this.mqttClient, 'livingroom/leftdoor');
    this.livingRoomLeftWindow = new ShutterControl('Living Room Left Window', platform, accessory, this.mqttClient, 'livingroom/leftwindow');
    this.livingRoomRightWindow = new ShutterControl('Living Room Right Window', platform, accessory, this.mqttClient, 'livingroom/rightwindow');
    this.livingRoomRightDoor = new ShutterControl('Living Room Right Door', platform, accessory, this.mqttClient, 'livingroom/rightdoor');
    this.kitchenDoor = new ShutterControl('Kitchen Door', platform, accessory, this.mqttClient, 'kitchen/door');
    this.kitchenLeftWindow = new ShutterControl('Kitchen Left Window', platform, accessory, this.mqttClient, 'kitchen/leftwindow');
    this.kitchenRightWindow = new ShutterControl('Kitchen Right Window', platform, accessory, this.mqttClient, 'kitchen/rightwindow');
  }
}