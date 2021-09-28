class DispatcherEvent {
  constructor(event) {
    this.event = event;
    this.callbacks = [];
  }

  register_callback(callback) {
    this.callbacks.push(callback);
  }

  unregister_callback(callback) {
    const index = this.callbacks.indexOf[callback];
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  fire(data) {
    const callbacks = this.callbacks.slice(0);
    callbacks.forEach((callback) => {
      callback(data);
    });
  }
}
exports.DispatcherEvent = DispatcherEvent;

class Dispatcher {
  constructor() {
    this.events = {};
  }

  dispatch(event_name, data) {
    const event = this.events[event_name];
    if (event) {
      event.fire(data);
    }
  }

  on(event_name, callback) {
    let event = this.events[event_name];
    if (!event) {
      event = new DispatcherEvent(event_name);
      this.events[event_name] = event;
    }
    event.register_callback(callback);
  }

  off(event_name, callback) {
    const event = this.events[event_name];
    if (event && event.callbacks.indexOf(callback) > -1) {
      event.unregister_callback(callback);
      if (event.callbacks.length === 0) {
        delete this.events[event_name];
      }
    }
  }
}
exports.Dispatcher = Dispatcher;