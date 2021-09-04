import { Service, PlatformAccessory, CharacteristicValue, Logger, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import { CategoryLogger } from './CategoryLogger';

import * as mqtt from 'mqtt';

class ZoneControls {
  private readonly valveService: Service;
  private readonly log: CategoryLogger;
  private readonly name: string;
  private inUse = false;

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly parentLogger: CategoryLogger,
    private readonly mqttClient: mqtt.Client,
    private readonly index: number,
  ) {
    this.name = `Zone ${this.index}`;

    const subType = this.name.replace(' ', '').toLowerCase();

    this.log = new CategoryLogger(this.platform.log, `ZoneControl(${this.name})`, this.parentLogger);

    this.log.info(`setting up: name=${this.name}, subType=${subType}`);

    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomintMqttMessage.bind(this));

    this.valveService = this.accessory.getServiceById(this.platform.Service.Valve, subType)
      || this.accessory.addService(this.platform.Service.Valve, this.name, subType);

    this.valveService.setCharacteristic(this.platform.Characteristic.Name, this.name);
    this.valveService.setCharacteristic(
      this.platform.Characteristic.ValveType,
      this.platform.Characteristic.ValveType.IRRIGATION,
    );
    this.valveService.setCharacteristic(
      this.platform.Characteristic.InUse,
      this.platform.Characteristic.InUse.NOT_IN_USE,
    );

    this.valveService.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
    this.valveService.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.name);

    this.valveService.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(async () => {
        this.log.info('getActive');
        return this.inUse
          ? this.platform.Characteristic.Active.ACTIVE
          : this.platform.Characteristic.Active.INACTIVE;
      })
      .onSet(async (value: CharacteristicValue) => {
        this.log.info('setActive:', value as string);
      });

    this.valveService.getCharacteristic(this.platform.Characteristic.ValveType)
      .onGet(async () => {
        this.log.info('getValveType');
        return this.platform.Characteristic.ValveType.GENERIC_VALVE;
      });
  }

  subscribeToMqttTopics(): void {
    this.log.info('subscribing to MQTT topics');
    this.mqttClient.subscribe(`irrigctl/zone/${this.index}/active`);
  }

  handleIncomintMqttMessage(topic: string, payload: Buffer): void {
    if (topic.toLowerCase() === `irrigctl/zone/${this.index}/active`) {
      this.log.info(`MQTT message arrived: topic=${topic}, payload=${payload.toString()}`);

      this.inUse = Number.parseInt(payload.toString()) === 1;

      this.valveService.updateCharacteristic(this.platform.Characteristic.InUse, this.inUse);
      this.valveService.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.inUse
          ? this.platform.Characteristic.InUse.IN_USE
          : this.platform.Characteristic.Active.INACTIVE,
      );
    }
  }
}

export class IrrigationSystemAccessory {
  private readonly service: Service;
  private readonly log: CategoryLogger;
  private readonly mqttClient: mqtt.Client;
  private readonly zoneControls: ZoneControls[];

  private inUse = false;
  private active = false;

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
  ) {
    this.log = new CategoryLogger(platform.log, `IrrigationSystem(${this.accessory.displayName})`);

    this.log.info(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
    this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);
    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomintMqttMessage.bind(this));

    this.service = this.accessory.getService(this.platform.Service.IrrigationSystem)
      || this.accessory.addService(this.platform.Service.IrrigationSystem);

    this.setupIrrigationSystemService();

    this.zoneControls = [
      new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, 1),
      new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, 2),
      new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, 3),
      new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, 4),
      new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, 5),
      new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, 6),
    ];
  }

  setupIrrigationSystemService(): void {
    this.service.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    this.service.getCharacteristic(this.platform.Characteristic.InUse)
      .onGet(async () => {
        return this.inUse
          ? this.platform.Characteristic.InUse.IN_USE
          : this.platform.Characteristic.InUse.NOT_IN_USE;
      });

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(async () => {
        return this.active
          ? this.platform.Characteristic.Active.ACTIVE
          : this.platform.Characteristic.Active.INACTIVE;
      });
  }

  subscribeToMqttTopics(): void {
    this.log.info('subscribing to MQTT topics');
    this.mqttClient.subscribe('irrigctl/pump/1/active');
  }

  handleIncomintMqttMessage(topic: string, payload: Buffer): void {
    if (topic.toLowerCase() === 'irrigctl/pump/1/active') {
      this.log.info(`MQTT message arrived: topic=${topic}, payload=${payload.toString()}`);

      this.inUse = Number.parseInt(payload.toString()) === 1;
      this.active = this.inUse;

      this.updateInUseCharacteristic();
      this.updateActiceCharacteristic();
    }
  }

  updateInUseCharacteristic(): void {
    this.service.updateCharacteristic(
      this.platform.Characteristic.InUse,
      this.inUse
        ? this.platform.Characteristic.InUse.IN_USE
        : this.platform.Characteristic.InUse.NOT_IN_USE,
    );
  }

  updateActiceCharacteristic(): void {
    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      this.active
        ? this.platform.Characteristic.Active.ACTIVE
        : this.platform.Characteristic.Active.INACTIVE,
    );
  }
}