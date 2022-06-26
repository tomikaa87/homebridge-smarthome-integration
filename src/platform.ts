import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

import { ThermostatAccessory } from './thermostatAccessory';
import { IrrigationSystemAccessory } from './irrigationSystemAccessory';
import { GreeAirConditionerAccessory } from './greeAirConditionerAccessory';
import { ShutterControllerAccessory } from './shutterControllerAccessory';
import { DoorbellAccessory } from './doorbellAccessory';
import { MqttTemperatureSensorAccessory } from './MqttTemperatureSensorAccessory';

import * as mqtt from 'mqtt';
import { MqttHumiditySensorAccessory } from './MqttHumiditySensorAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SmartHomeIntegrationPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private readonly mqttClient: mqtt.Client;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    this.log.info(`Connecting to the MQTT broker: url=${this.config.mqttBrokerUrl}`);
    this.mqttClient = mqtt.connect(this.config.mqttBrokerUrl);
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  private setupAccessory(uniqueId: string, displayName: string, constructFunc: (accessory: PlatformAccessory) => void) {
    const uuid = this.api.hap.uuid.generate(uniqueId);

    this.log.info(`Setting up accessory: uniqueId=${uniqueId}, displayName=${displayName}, uuid=${uuid}`);

    let accessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (accessory) {
      this.log.info(`Restoring existing accessory from cache: ${accessory.displayName}`);
    } else {
      this.log.info(`Creating new accessory: ${displayName}`);
      accessory = new this.api.platformAccessory(displayName, uuid);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    accessory.context.device = {
      uniqueId: uniqueId,
      displayName: displayName,
    };

    // TODO is this necessary? just return the accessory to the constructor
    constructFunc(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // Create Gree devices based on the config
    if (this.config.greeDevices !== undefined) {
      this.log.info(`Trying to load Gree devices from config: ${JSON.stringify(this.config.greeDevices)}`);

      this.config.greeDevices.forEach(gd => {
        if (gd.name !== undefined && gd.address !== undefined) {
          const uniqueId = `GreeDevice-${gd.address}`;

          this.log.info(`Creating Gree device: name=${gd.name}, address=${gd.address}, uniqueId=${uniqueId}`);

          this.setupAccessory(uniqueId, gd.name, (accessory: PlatformAccessory) => {
            new GreeAirConditionerAccessory(this, accessory, gd.address);
          });
        } else {
          this.log.warn(`Invalid Gree device entry found: ${JSON.stringify(gd)}`);
        }
      });

      // Create Shutter Controller devices based on the config
      if (this.config.shutterControllers !== undefined) {
        this.log.info(`Trying to load Shutter Controller devices from config: ${JSON.stringify(this.config.shutterControllers)}`);

        this.config.shutterControllers.forEach(controller => {
          const uniqueId = `ShutterController-${controller.name}`;

          if (controller.name !== undefined && controller.mqttSubTopic !== undefined) {
            this.setupAccessory(uniqueId, controller.name, (accessory: PlatformAccessory) => {
              new ShutterControllerAccessory(this, accessory, this.config, controller.name, controller.mqttSubTopic);
            });
          } else {
            this.log.warn(`Invalid Shutter Controller device entry found: ${JSON.stringify(controller)}`);
          }
        });
      }
    }

    this.log.info('Creating Doorbell Accessory');
    this.setupAccessory('doorbell1', 'Doorbell', (accessory: PlatformAccessory) => {
      new DoorbellAccessory(this, accessory, this.config);
    });

    this.log.info('Creating Bedroom temperature sensor');
    this.setupAccessory('bedroomTempSensor', 'Bedroom Temperature Sensor', (accessory: PlatformAccessory) => {
      new MqttTemperatureSensorAccessory('smc/temp/current', this, accessory, this.mqttClient, (value: number) => value);
    });

    this.log.info('Creating Baby room temperature sensor');
    this.setupAccessory('babyRoomTempSensor', 'Baby room Temperature Sensor', (accessory: PlatformAccessory) => {
      new MqttTemperatureSensorAccessory('home/temperature/baby_room', this, accessory, this.mqttClient, (value: number) => value);
    });

    this.log.info('Creating Baby room humidity sensor');
    this.setupAccessory('babyRoomHumiditySensor', 'Baby room Humidity Sensor', (accessory: PlatformAccessory) => {
      new MqttHumiditySensorAccessory('home/humidity/baby_room', this, accessory, this.mqttClient, (value: number) => value);
    });

    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.
    const devices = [
      {
        uniqueId: 'SmartHomeThermostat-1',
        displayName: 'Thermostat',
        deviceType: 'thermostat',
      },
      {
        uniqueId: 'IrrigationSystem-1',
        displayName: 'Irrigation',
        deviceType: 'irrigation-system',
      },
    ];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        if (device.deviceType === 'thermostat') {
          new ThermostatAccessory(this, existingAccessory, this.config);
        } else if (device.deviceType === 'irrigation-system') {
          new IrrigationSystemAccessory(this, existingAccessory, this.config);
        }

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        if (device.deviceType === 'thermostat') {
          new ThermostatAccessory(this, accessory, this.config);
        } else if (device.deviceType === 'irrigation-system') {
          new IrrigationSystemAccessory(this, accessory, this.config);
        }

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
