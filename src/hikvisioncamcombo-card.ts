import { LitElement, html, customElement, property, TemplateResult, PropertyValues } from 'lit-element';
import {
  HomeAssistant,
  hasAction,
  handleAction,
  LovelaceCardEditor,
  domainIcon,
  computeDomain,
} from 'custom-card-helpers';

import './editor';

import { HikvisionCamComboCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
import {
  mergeDeep,
  hasConfigOrEntitiesChanged,
  createConfigArray,
  sortByDates,
  groupByLastTrippedTime,
} from './helpers';
import { styles } from './styles';

/* eslint no-console: 0 */
console.info(
  `%c  HikvisionCamCombo-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: white; font-weight: bold; background: blue',
  'color: white; font-weight: bold; background: dimgray',
);

// TODO Name your custom element
@customElement('hikvisioncamcombo-card')
export class HikvisioncamcomboCard extends LitElement {
  private _entityName!: string;

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('hikvisioncamcombo-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

  @property() public hass?: HomeAssistant;
  @property() private _config!: HikvisionCamComboCardConfig;
  @property() private _configArray: HikvisionCamComboCardConfig[] = [];
  private _stateArray: any[] = [];
  private _animationState: any[] = [];
  private eventsList!: any[] | [];
  private _rowAmount = 1;
  private _EventNumMax = [];
  private _EventNumMin = 0;
  private _currentEventNum: Array<number> = []; //this._EventNumMax;

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return hasConfigOrEntitiesChanged(this, changedProps, false);
  }

  async fetchRecent(entityId, start, end, skipInitialState, withAttributes): Promise<object> {
    let url = 'history/period';
    if (start) url += `/${start.toISOString()}`;
    url += `?filter_entity_id=${entityId.entity}`;
    if (end) url += `&end_time=${end.toISOString()}`;
    if (skipInitialState) url += '&skip_initial_state';
    if (!withAttributes) url += '&minimal_response';
    if (withAttributes) url += '&significant_changes_only=0';
    // @ts-ignore
    return this.hass.callApi('GET', url);
  }

  private async getHistoryData(enityArray, start, end): Promise<object> {
    let hist: any = [];
    for (const obj of enityArray) {
      const response = await this.fetchRecent(obj, start, end, true, true);
      hist = hist.concat(response[0]);
    }
    hist = hist
      .filter(function(o) {
        if (!o.attributes.box) {
          return false;
        } else {
          return o;
        }
      })
      .map(function(o) {
        return o.attributes;
      });
    //this._EventNumMax = this.eventsList.length - 1;
    //this._currentEventNum = this._EventNumMax;
    hist.sort(sortByDates);
    this.eventsList = groupByLastTrippedTime(hist, 60000).slice(-10);
    console.warn('this.eventsList', this.eventsList);
    this.eventsList.forEach(value => {
      // @ts-ignore
      this._EventNumMax.push(value.length - 1);
      return;
    });
    this._currentEventNum = [...this._EventNumMax];
    await this.requestUpdate();
    //// @ts-ignore
    //const elt = this.shadowRoot.querySelector(
    //  '#hikvisioncamcombo__' + this._entityName + '_item_' + this._currentEventNum,
    //);
    //if (elt) elt.scrollIntoView({ inline: 'nearest' });
    //this._get_canvas(this.eventsList[this._currentEventNum]);
    this.eventsList.forEach((value, index) => {
      console.error(value);
      this._get_canvas(value[this._currentEventNum[index]], index);
    });
    return this.eventsList;
  }

  public setConfig(config: HikvisionCamComboCardConfig): void {
    console.info('CONFIG', config);
    if (!config) {
      throw new Error(localize('common.invalid_configuration'));
    }

    this._config = mergeDeep(
      {
        animation: {
          state: 'off',
          speed: 5,
        },
        color: 'var(--bar-card-color, var(--primary-color))',
        columns: 1,
        direction: 'right',
        //max: 100,
        //min: 0,
        positions: {
          icon: 'outside',
          indicator: 'outside',
          name: 'inside',
          minmax: 'off',
          value: 'inside',
        },
      },
      config,
    );
    if (config.name) this._entityName = config.name;
    if (this._config.stack == 'horizontal') this._config.columns = this._config.entities.length;
    this._configArray = createConfigArray(this._config);
    console.log('this._configArray', this._configArray);
    this._rowAmount = this._configArray.length / this._config.columns;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    return html`
      <ha-card
        .header=${this._config.title ? this._config.title : null}
        style="${this._config.entity_row ? 'background: #0000; box-shadow: none;' : ''}"
      >
        ${styles}

        <div
          class="hikvisioncamcombo-card"
          style="${this._config.entity_row ? 'padding: 0px;' : ''} ${this._config.direction == 'up'
            ? ''
            : 'flex-grow: 0;'}"
        >
          ${this._createHikvisionArray().length === 0
            ? html`
                <div class="hikvisioncamcombo-card_empty">
                  <div>${this._entityName}</div>
                  <div>No Events</div>
                </div>
              `
            : this._createHikvisionArray()}
        </div>
      </ha-card>
    `;
  }

  private _shortTime(timeStr): TemplateResult {
    const time = new Date(timeStr);
    return html`
      <date>${time.toLocaleDateString('en-US')}</date>
      <time>${time.toLocaleTimeString('en-US')}</time>
    `;
  }
  private _getNavBar(list, eventIndex): TemplateResult {
    const copy_list = [...list];
    return html`
      ${copy_list.reverse().map((item, i, array) => {
        const j = array.length - 1 - i;

        return html`
          <item
            id="hikvisioncamcombo__${eventIndex}_item_${j}"
            class="${j === this._currentEventNum[eventIndex] ? 'hikvisioncamcombo__item_selected' : ''}"
            @click="${(): void => this._setCurrentEventNum(j, eventIndex)}"
          >
            ${this._shortTime(item.last_tripped_time)}
          </item>
        `;
      })}
    `;
  }

  private _getEvents(list): TemplateResult {
    const copy_list = [...list];
    this.requestUpdate();
    return html`
      ${copy_list.map((value, index) => {
        return html`
          <item>
            <div class="hikvisioncamcombo__img">
              <canvas id="canvas_${index}"></canvas>
            </div>
            <nav-bar>${this._getNavBar(value, index)}</nav-bar>
          </item>
        `;
      })}
    `;
  }

  private _getBox(currentEventData): string {
    try {
      return currentEventData.box.join(', ');
    } catch (error) {
      console.error(error);
      return '';
    }
  }

  private _createHikvisionArray(): TemplateResult[] {
    const perRowArray: object[] = [];
    const rowArray: TemplateResult[] = [];
    console.log('this.haas', this.hass);
    //this._configArray.forEach(sensor => {
    //  perRowArray +=
    //});
    const sensorStatus = this._configArray.find(obj => {
      return obj.entity.includes(this._entityName);
    });
    console.log('sensorStatus', sensorStatus);

    const end = new Date();
    const start = new Date(new Date().getTime() - 168 * 60 * 60 * 1000);
    console.info('rowArray0', rowArray);
    if (!this.eventsList) {
      this.getHistoryData(this._configArray, start, end);
      return rowArray;
    }
    const currentEventData = this.eventsList[0];
    //if (!currentEventData) {
    //  return rowArray;
    //}
    rowArray.push(html`
      <hikvisioncamcombo-main>
        <events>
          ${this._getEvents(this.eventsList)}
        </events>
      </hikvisioncamcombo-main>
    `);

    return rowArray;
  }

  _imgUrl(file_path): string {
    const path = '/local/hikvision/';
    const file = file_path.split('/').slice(-1);
    return path + encodeURIComponent(file);
  }

  _imgUrlCropped(file_path): string {
    const path = '/local/hikvision/';
    const file =
      file_path
        .split('/')
        .slice(-1)[0]
        .split('.jpg')[0] + '.crop.jpg';
    return path + encodeURIComponent(file);
  }

  _setCurrentEventNum(i, eventIndex): void {
    console.warn('_setCurrentEventNum');
    if (i <= this._EventNumMax[eventIndex] && i >= this._EventNumMin) {
      this._currentEventNum[eventIndex] = i;
      this.requestUpdate();
      const currentEventData = this.eventsList[eventIndex][this._currentEventNum[eventIndex]];
      this._get_canvas(currentEventData, eventIndex);
    }
  }

  //  _previous(): void {
  //    if (this._currentEventNum > this._EventNumMin) {
  //      this._currentEventNum -= 1;
  //      this.requestUpdate();
  //      const currentEventData = this.eventsList[this._currentEventNum];
  //      // @ts-ignore
  //      const elt = this.shadowRoot.querySelector(
  //        '#hikvisioncamcombo__' + this._entityName + '_item_' + this._currentEventNum,
  //      );
  //      if (elt) elt.scrollIntoView({ inline: 'nearest' });
  //
  //      this._get_canvas(currentEventData);
  //    }
  //  }

  //  _next(sensorStatus, start, end): void {
  //    if (this._currentEventNum < this._EventNumMax) {
  //      this._currentEventNum += 1;
  //      this.requestUpdate();
  //      // @ts-ignore
  //      const elt = this.shadowRoot.querySelector(
  //        '#hikvisioncamcombo__' + this._entityName + '_item_' + this._currentEventNum,
  //      );
  //      if (elt) elt.scrollIntoView({ inline: 'nearest' });
  //      const currentEventData = this.eventsList[this._currentEventNum];
  //      this._get_canvas(currentEventData);
  //    } else {
  //      this.getHistoryData(sensorStatus, start, end);
  //    }
  //  }
  //
  //  _latest(sensorStatus, start, end): void {
  //    this.getHistoryData(sensorStatus, start, end);
  //  }

  _get_canvas(currentEventData, eventIndex): void {
    // @ts-ignore
    const canvas = this.shadowRoot.querySelector('#canvas_' + eventIndex);
    // @ts-ignore
    const ctx = canvas.getContext('2d');
    // @ts-ignore
    const img = new Image();
    const imgCropped = new Image();
    img.addEventListener(
      'load',
      function() {
        const box = currentEventData.box;
        ctx.canvas.width = window.innerWidth;
        ctx.canvas.height = (window.innerWidth * img.height) / img.width;
        ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.strokeStyle = '#06f906';
        ctx.lineWidth = 5;
        ctx.strokeRect(
          box[0] * ctx.canvas.width,
          box[1] * ctx.canvas.height,
          box[2] * ctx.canvas.width,
          box[3] * ctx.canvas.height,
        );
        let croppedStartX = 5;
        let croppedStartY = 5;
        let mult = Math.trunc((ctx.canvas.height - croppedStartY) / imgCropped.height);
        if (imgCropped.width > imgCropped.height) {
          mult = Math.trunc((ctx.canvas.height - croppedStartY) / imgCropped.width);
        }
        if (mult <= 2) {
          mult = 3;
        } else if (mult > 10) {
          mult = 10;
        }

        if (box[0] * ctx.canvas.width < imgCropped.width * mult) {
          croppedStartX = ctx.canvas.width - imgCropped.width * mult - 5;
          croppedStartY = ctx.canvas.height - imgCropped.height * mult - 5;
        }
        ctx.strokeRect(croppedStartX, croppedStartY, imgCropped.width * mult, imgCropped.height * mult);
        ctx.drawImage(imgCropped, croppedStartX, croppedStartY, imgCropped.width * mult, imgCropped.height * mult);
      },
      false,
    );
    img.src = this._imgUrl(currentEventData.file_path);
    imgCropped.src = this._imgUrlCropped(currentEventData.file_path);
  }

  getCardSize(): number {
    return 25;
  }
}
