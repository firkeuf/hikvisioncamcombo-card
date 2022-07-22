import { PropertyValues } from 'lit-element';
import { HomeAssistant } from 'custom-card-helpers';
import { HikvisionCamComboCardConfig } from './types';

/**
 * Performs a deep merge of objects and returns new object. Does not modify
 * objects (immutable) and merges arrays via concatenation and filtering.
 *
 * @param {...object} objects - Objects to merge
 * @returns {object} New object with merged key/values
 */
export function mergeDeep(...objects: any): any {
  const isObject = (obj: any) => obj && typeof obj === 'object';

  return objects.reduce((prev: any, obj: any) => {
    Object.keys(obj).forEach(key => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        /* eslint no-param-reassign: 0 */
        prev[key] = pVal.concat(...oVal);
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
}

export function mapRange(num: number, in_min: number, in_max: number, out_min: number, out_max: number): number {
  return ((num - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
}

// Check if config or Entity changed
export function hasConfigOrEntitiesChanged(element: any, changedProps: PropertyValues, forceUpdate: boolean): boolean {
  if (changedProps.has('config') || forceUpdate) {
    return true;
  }
  for (const config of element._configArray) {
    if (config.entity) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
      if (oldHass) {
        if (oldHass.states[config.entity] !== element.hass!.states[config.entity]) {
          return true;
        } else {
          continue;
        }
      }
      return true;
    }
  }
  return false;
}

export function createConfigArray(config): HikvisionCamComboCardConfig[] {
  const configArray: HikvisionCamComboCardConfig[] = [];
  if (config.entities) {
    for (const entityConfig of config.entities) {
      if (typeof entityConfig == 'string') {
        const clonedObject = mergeDeep({}, config);
        delete clonedObject.entities;
        const stringConfig = mergeDeep(clonedObject, { entity: entityConfig });
        configArray.push(stringConfig);
      } else if (typeof entityConfig == 'object') {
        const clonedObject = mergeDeep({}, config);
        delete clonedObject.entities;
        const objectConfig = mergeDeep(clonedObject, entityConfig);
        configArray.push(objectConfig);
      }
    }
  } else {
    configArray.push(config);
  }
  return configArray;
}

export function createEditorConfigArray(config): HikvisionCamComboCardConfig[] {
  const configArray: HikvisionCamComboCardConfig[] = [];
  if (config.entities) {
    for (const entityConfig of config.entities) {
      if (typeof entityConfig == 'string') {
        const stringConfig = mergeDeep({}, { entity: entityConfig });
        configArray.push(stringConfig);
      } else if (typeof entityConfig == 'object') {
        const objectConfig = mergeDeep({}, entityConfig);
        configArray.push(objectConfig);
      }
    }
  } else {
    configArray.push(config);
  }
  return configArray;
}

export function arrayMove(arr, fromIndex, toIndex): any[] {
  const element = arr[fromIndex];
  const newArray = arr.slice();
  newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, element);
  return newArray;
}

export function sortByDates(a, b): number {
  // @ts-ignore
  return new Date(a.last_tripped_time) - new Date(b.last_tripped_time);
}

export function groupByLastTrippedTime(collection, timedelta): Array<object> {
  let i = 0;
  let j = 0;
  let val;
  //const timedelta = 60000; // ms
  const values: Array<any> = [];
  const result: Array<any> = [];
  for (; i < collection.length; i++) {
    val = new Date(collection[i]['last_tripped_time']);
    const valuesLength = values.length;
    for (j = 0; j <= valuesLength; j++) {
      if (values[j] !== val && val - values[j] <= timedelta) {
        result[j].push(collection[i]);
        break;
      } else if (j === valuesLength - 1 || valuesLength === 0) {
        values.push(val);
        result.push([collection[i]]);
        break;
      }
    }
  }
  return result;
}
