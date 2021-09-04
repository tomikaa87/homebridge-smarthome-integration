import { Service, PlatformAccessory, CharacteristicValue, Logger, PlatformConfig } from 'homebridge';

import { SmartHomeIntegrationPlatform } from './platform';

import * as mqtt from 'mqtt';

class ZoneControls {
  private readonly valveService: Service;
  private inUse = false;

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly parentService: Service,
    private readonly name: string,
  ) {
    const subType = this.name.replace(' ', '').toLowerCase();

    this.platform.log.info(`setting up ZoneControl: name=${this.name}, subType=${subType}`);

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
        this.platform.log.info('getActive');
        return this.inUse
          ? this.platform.Characteristic.Active.ACTIVE
          : this.platform.Characteristic.Active.INACTIVE;
      })
      .onSet(async (value: CharacteristicValue) => {
        this.platform.log.info('setActive:', value as string);

        setTimeout(() => {
          this.inUse = true;
          this.valveService.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.ACTIVE,
          );
          this.valveService.updateCharacteristic(
            this.platform.Characteristic.InUse,
            this.platform.Characteristic.InUse.IN_USE,
          );

          setTimeout(() => {
            this.inUse = false;
            this.valveService.updateCharacteristic(
              this.platform.Characteristic.Active,
              this.platform.Characteristic.Active.INACTIVE,
            );
            this.valveService.updateCharacteristic(
              this.platform.Characteristic.InUse,
              this.platform.Characteristic.InUse.NOT_IN_USE,
            );
          }, 5000);
        }, 3000);
      });

    this.valveService.getCharacteristic(this.platform.Characteristic.ValveType)
      .onGet(async () => {
        this.platform.log.info('getValveType');
        return this.platform.Characteristic.ValveType.GENERIC_VALVE;
      });
  }
}

export class IrrigationSystemAccessory {
  private readonly service: Service;
  // private readonly mqttClient: mqtt.Client;
  private readonly log: Logger;
  private readonly zoneControls: ZoneControls[];

  private states = {
    inUse: false,
  };

  constructor(
    private readonly platform: SmartHomeIntegrationPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly config: PlatformConfig,
  ) {
    this.log = platform.log;

    this.service = this.accessory.getService(this.platform.Service.IrrigationSystem)
      || this.accessory.addService(this.platform.Service.IrrigationSystem);

    this.setupIrrigationSystemService();

    this.zoneControls = [
      new ZoneControls(this.platform, this.accessory, this.service, 'Zone 1'),
      new ZoneControls(this.platform, this.accessory, this.service, 'Zone 2'),
      new ZoneControls(this.platform, this.accessory, this.service, 'Zone 3'),
      new ZoneControls(this.platform, this.accessory, this.service, 'Zone 4'),
      new ZoneControls(this.platform, this.accessory, this.service, 'Zone 5'),
      new ZoneControls(this.platform, this.accessory, this.service, 'Zone 6'),
    ];
  }

  setupIrrigationSystemService(): void {
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    this.service.getCharacteristic(this.platform.Characteristic.InUse)
      .onGet(this.getInUse.bind(this));
  }

  async getInUse(): Promise<CharacteristicValue> {
    return this.states.inUse;
  }
}