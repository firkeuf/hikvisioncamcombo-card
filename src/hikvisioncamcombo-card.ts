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

import { BarCardConfig } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
import { mergeDeep, hasConfigOrEntitiesChanged, createConfigArray } from './helpers';
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
  @property() private _config!: BarCardConfig;
  @property() private _configArray: BarCardConfig[] = [];
  private _stateArray: any[] = [];
  private _animationState: any[] = [];
  private eventsList!: any[] | [];
  private _rowAmount = 1;
  private _EventNumMax = 0;
  private _EventNumMin = 0;
  private _currentEventNum = this._EventNumMax;

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

  private async getHistoryData(enityId, start, end): Promise<object> {
    const response = await this.fetchRecent(enityId, start, end, true, true);
    const hist = response[0]
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

    this.eventsList = hist;
    this._EventNumMax = hist.length - 1;
    this._currentEventNum = this._EventNumMax;

    await this.requestUpdate();
    // @ts-ignore
    const elt = this.shadowRoot.querySelector('#hikvisioncamcombo__' + this._entityName + '_item_' + this._currentEventNum);
    if (elt) elt.scrollIntoView({ inline: 'nearest' });
    this._get_canvas(this.eventsList[this._currentEventNum]);
    return response;
  }

  public setConfig(config: BarCardConfig): void {
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
    this._entityName = config.entities[0].entity;

    if (this._config.stack == 'horizontal') this._config.columns = this._config.entities.length;
    this._configArray = createConfigArray(this._config);
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
  private _getNavBar(list): TemplateResult {
    const copy_list = [...list];
    return html`
      ${copy_list.reverse().map((item, i, array) => {
        const j = array.length - 1 - i;

        return html`
          <item
            id="hikvisioncamcombo__${this._entityName}_item_${j}"
            class="${j == this._currentEventNum ? 'hikvisioncamcombo__item_selected' : ''}"
            @click="${(): void => this._setCurrentEventNum(j)}"
          >
            ${this._shortTime(item.last_tripped_time)}
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
    const sensorStatus = this._configArray.find(obj => {
      return obj.entity.includes(this._entityName);
    });

    const end = new Date();
    const start = new Date(new Date().getTime() - 168 * 60 * 60 * 1000);
    if (!this.eventsList) {
      this.getHistoryData(sensorStatus, start, end);
      return rowArray;
    }
    const currentEventData = this.eventsList[this._currentEventNum];
    if (!currentEventData) {
      return rowArray;
    }
    rowArray.push(html`
      <hikvision-main>
        <nav-bar>
          ${this._getNavBar(this.eventsList)}
        </nav-bar>
        <hikvision-content>
          <div class="hikvisioncamcombo__data">
            <div class="hikvisioncamcombo__name">
              ${currentEventData.friendly_name}
            </div>
            <div class="hikvisioncamcombo__date">
              ${this._shortTime(currentEventData.last_tripped_time)}
            </div>
            <div class="hikvisioncamcombo__box">
              Detected object: ${currentEventData.detected_object}
            </div>
          </div>

          <div class="hikvisioncamcombo__img">
            <canvas id="canvas"></canvas>
          </div>

          <div class="hikvisioncm__control">
            ${this._currentEventNum}
            <previous-event title="Previous event." @click="${this._previous}">
              <hikvision-card-iconbar>
                <ha-icon style="color: #7d7d7d" icon="mdi:arrow-left-bold-circle-outline"></ha-icon>
              </hikvision-card-iconbar>
            </previous-event>
            <next-event title="Next event." @click="${(): void => this._next(sensorStatus, start, end)}">
              <hikvision-card-iconbar>
                <ha-icon style="color: #7d7d7d" icon="mdi:arrow-right-bold-circle-outline"></ha-icon>
              </hikvision-card-iconbar>
            </next-event>
            <latest-event title="Latest event." @click="${(): void => this._latest(sensorStatus, start, end)}">
              <hikvision-card-iconbar>
                <ha-icon style="color: #7d7d7d" icon="mdi:lastpass"></ha-icon>
              </hikvision-card-iconbar>
            </latest-event>
          </div>
        </hikvision-content>
      </hikvision-main>
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

  _setCurrentEventNum(i): void {
    if (i <= this._EventNumMax && i >= this._EventNumMin) {
      this._currentEventNum = i;
      this.requestUpdate();
      const currentEventData = this.eventsList[this._currentEventNum];
      this._get_canvas(currentEventData);
    }
  }

  _previous(): void {
    if (this._currentEventNum > this._EventNumMin) {
      this._currentEventNum -= 1;
      this.requestUpdate();
      const currentEventData = this.eventsList[this._currentEventNum];
      // @ts-ignore
      const elt = this.shadowRoot.querySelector(
        '#hikvisioncamcombo__' + this._entityName + '_item_' + this._currentEventNum,
      );
      if (elt) elt.scrollIntoView({ inline: 'nearest' });

      this._get_canvas(currentEventData);
    }
  }

  _next(sensorStatus, start, end): void {
    if (this._currentEventNum < this._EventNumMax) {
      this._currentEventNum += 1;
      this.requestUpdate();
      // @ts-ignore
      const elt = this.shadowRoot.querySelector(
        '#hikvisioncamcombo__' + this._entityName + '_item_' + this._currentEventNum,
      );
      if (elt) elt.scrollIntoView({ inline: 'nearest' });
      const currentEventData = this.eventsList[this._currentEventNum];
      this._get_canvas(currentEventData);
    } else {
      this.getHistoryData(sensorStatus, start, end);
    }
  }

  _latest(sensorStatus, start, end): void {
    this.getHistoryData(sensorStatus, start, end);
  }

  _get_canvas(currentEventData): void {
    // @ts-ignore
    const canvas = this.shadowRoot.querySelector('#canvas');
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
    return 2;
  }
}
