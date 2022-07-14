import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import { CategoryLogger } from './CategoryLogger';

import * as mqtt from 'mqtt';

import { toActiveValue, toInUseValue } from './Utils';

class ZoneControls {
  private readonly valveService: Service;
  private readonly log: CategoryLogger;
  private readonly name: string;
  private inUse = false;
  private active = false;

  private readonly activeStateTopic: string;
  private readonly inUseStateTopic: string;

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly parentLogger: CategoryLogger,
    private readonly mqttClient: mqtt.Client,
    private readonly index: number,
    private readonly configuredName: string = '',
  ) {
    this.name = `Zone ${this.index}`;

    const subType = this.name.replace(' ', '').toLowerCase();

    this.log = new CategoryLogger(this.platform.log, `ZoneControl(${this.name})`, this.parentLogger);

    this.activeStateTopic = `irrigctl/zone/${this.index}/active`;
    this.inUseStateTopic = `irrigctl/zone/${this.index}/inUse`;

    this.log.debug(`setting up: name=${this.name}, subType=${subType}`);
    this.log.debug('activeStateTopic:', this.activeStateTopic);
    this.log.debug('inUseStateTopic:', this.inUseStateTopic);

    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomintMqttMessage.bind(this));

    this.valveService = this.accessory.getServiceById(this.platform.Service.Valve, subType)
      || this.accessory.addService(this.platform.Service.Valve, this.name, subType);

    this.valveService.setCharacteristic(this.platform.Characteristic.Name, this.name);
    this.valveService.setCharacteristic(
      this.platform.Characteristic.ValveType,
      this.platform.Characteristic.ValveType.IRRIGATION,
    );

    this.valveService.addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
    this.valveService.setCharacteristic(
      this.platform.Characteristic.ConfiguredName,
      this.configuredName !== ''
        ? this.configuredName
        : this.name,
    );

    this.valveService.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(async () => {
        this.log.debug('getActive');
        return toActiveValue(this.active, this.platform);
      })
      .onSet(async (value: CharacteristicValue) => {
        this.log.debug('setActive:', value as string);

        this.active = value as boolean;

        this.mqttClient.publish(this.activeStateTopic + '/set', this.active ? '1' : '0');
      });

    this.valveService.getCharacteristic(this.platform.Characteristic.InUse)
      .onGet(async () => {
        this.log.debug('getInUse');
        return toInUseValue(this.inUse, this.platform);
      });

    this.valveService.getCharacteristic(this.platform.Characteristic.ValveType)
      .onGet(async () => {
        this.log.debug('getValveType');
        return this.platform.Characteristic.ValveType.GENERIC_VALVE;
      });
  }

  subscribeToMqttTopics(): void {
    this.log.debug('subscribing to MQTT topics');
    this.mqttClient.subscribe(this.activeStateTopic);
    this.mqttClient.subscribe(this.inUseStateTopic);
  }

  handleIncomintMqttMessage(topic: string, payload: Buffer): void {
    if (topic.toLowerCase() === this.activeStateTopic.toLocaleLowerCase()) {
      this.active = Number.parseInt(payload.toString()) === 1;
      this.log.debug(`this.active updated: ${this.active}`);
    } else if (topic.toLowerCase() === this.inUseStateTopic.toLocaleLowerCase()) {
      this.inUse = Number.parseInt(payload.toString()) === 1;
      this.log.debug(`this.inUse updated: ${this.inUse}`);
    }

    this.log.debug(`this.active=${this.active}, this.inUse=${this.inUse}`);

    this.valveService.updateCharacteristic(this.platform.Characteristic.Active, toActiveValue(this.active, this.platform));
    this.valveService.updateCharacteristic(this.platform.Characteristic.InUse, toInUseValue(this.inUse, this.platform));
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

    this.log.debug(`connecting to MQTT broker: url=${this.config.mqttBrokerUrl}`);
    this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl, {
      username: this.config.mqttUsername,
      password: this.config.mqttPassword,
    });
    this.mqttClient.on('connect', this.subscribeToMqttTopics.bind(this));
    this.mqttClient.on('message', this.handleIncomintMqttMessage.bind(this));

    this.service = this.accessory.getService(this.platform.Service.IrrigationSystem)
      || this.accessory.addService(this.platform.Service.IrrigationSystem);

    this.setupIrrigationSystemService();

    this.zoneControls = [
      this.createZoneControls(1),
      this.createZoneControls(2),
      this.createZoneControls(3),
      this.createZoneControls(4),
      this.createZoneControls(5),
      this.createZoneControls(6),
    ];
  }

  setupIrrigationSystemService(): void {
    this.service.addOptionalCharacteristic(this.platform.Characteristic.Name);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    this.service.getCharacteristic(this.platform.Characteristic.InUse)
      .onGet(async () => {
        return toInUseValue(this.inUse, this.platform);
      });

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(async () => {
        return toActiveValue(this.active, this.platform);
      });
  }

  subscribeToMqttTopics(): void {
    this.log.debug('subscribing to MQTT topics');
    this.mqttClient.subscribe('irrigctl/pump/1/active');
  }

  handleIncomintMqttMessage(topic: string, payload: Buffer): void {
    this.log.debug(`MQTT message arrived: topic=${topic}, payload=${payload.toString()}`);

    if (topic.toLowerCase() === 'irrigctl/pump/1/active') {
      this.inUse = Number.parseInt(payload.toString()) === 1;
      this.active = this.inUse;
    }

    this.updateInUseCharacteristic();
    this.updateActiceCharacteristic();
  }

  updateInUseCharacteristic(): void {
    this.service.updateCharacteristic(
      this.platform.Characteristic.InUse,
      toInUseValue(this.inUse, this.platform),
    );
  }

  updateActiceCharacteristic(): void {
    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      toActiveValue(this.inUse, this.platform),
    );
  }

  createZoneControls(zone: number): ZoneControls {
    let configuredName = '';

    if (this.config.zones !== undefined) {
      this.log.debug('config.zones:', this.config.zones);

      this.config.zones.forEach(z => {
        if (z.number === zone) {
          configuredName = z.configuredName;
          this.log.debug(`using configured name for zone ${zone}: ${configuredName}`);
        }
      });
    }

    return new ZoneControls(this.platform, this.accessory, this.log, this.mqttClient, zone, configuredName);
  }
}