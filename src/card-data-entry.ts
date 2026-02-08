import { CardData, OcgcoreCommonConstants } from 'ygopro-msg-encode';
import { CdbSqljsRow, CdbSqljsRowData, CdbSqljsRowText } from './types';
import {
  toNumberArrayFromSetcode,
  toSetcodeFromNumberArray,
} from './utility/setcode-array';

const STRING_SLOTS = 16;

export class CardDataEntry extends CardData {
  ot = 0;
  category = 0;
  name = '';
  desc = '';
  strings: string[] = Array(STRING_SLOTS).fill('');

  fromPartial(data: Partial<this>): this {
    super.fromPartial(data);

    const ot = data.ot ?? 0;
    const category = data.category ?? 0;
    const name = data.name ?? '';
    const desc = data.desc ?? '';
    const input = data.strings ?? [];
    const strings = Array(STRING_SLOTS).fill('');
    for (let i = 0; i < STRING_SLOTS && i < input.length; i++) {
      const value = input[i];
      strings[i] = value != null ? String(value) : '';
    }

    this.ot = ot;
    this.category = category;
    this.name = name;
    this.desc = desc;
    this.strings = strings;
    return this;
  }

  fromSqljsRow(row: CdbSqljsRow): this {
    const type = (row.type ?? 0) >>> 0;
    const attack = row.atk ?? 0;
    let defense = row.def ?? 0;
    let linkMarker = 0;
    if ((type & OcgcoreCommonConstants.TYPE_LINK) >>> 0 !== 0) {
      linkMarker = defense;
      defense = 0;
    }
    const levelRaw = (row.level ?? 0) >>> 0;
    const level = (levelRaw & 0xff) >>> 0;
    const lscale = ((levelRaw >>> 24) & 0xff) >>> 0;
    const rscale = ((levelRaw >>> 16) & 0xff) >>> 0;

    Object.assign(this, {
      code: row.id,
      ot: row.ot ?? 0,
      alias: row.alias ?? 0,
      setcode: toNumberArrayFromSetcode(row.setcode ?? 0),
      type,
      level,
      attribute: (row.attribute ?? 0) >>> 0,
      race: (row.race ?? 0) >>> 0,
      attack,
      defense,
      lscale,
      rscale,
      linkMarker,
      category: row.category ?? 0,
      name: row.name ?? '',
      desc: row.desc ?? '',
      strings: [
        row.str1 ?? '',
        row.str2 ?? '',
        row.str3 ?? '',
        row.str4 ?? '',
        row.str5 ?? '',
        row.str6 ?? '',
        row.str7 ?? '',
        row.str8 ?? '',
        row.str9 ?? '',
        row.str10 ?? '',
        row.str11 ?? '',
        row.str12 ?? '',
        row.str13 ?? '',
        row.str14 ?? '',
        row.str15 ?? '',
        row.str16 ?? '',
      ],
    });
    return this;
  }

  toSqljsRow() {
    const type = this.type >>> 0;
    const isLink = (type & OcgcoreCommonConstants.TYPE_LINK) >>> 0 !== 0;
    const attack = this.attack ?? 0;
    const defense = isLink ? (this.linkMarker ?? 0) : (this.defense ?? 0);
    const level =
      ((this.level ?? 0) & 0xff) |
      (((this.rscale ?? 0) & 0xff) << 16) |
      (((this.lscale ?? 0) & 0xff) << 24);

    const strings = this.strings ?? [];
    const getString = (index: number) => {
      const value = strings[index];
      return value != null ? String(value) : '';
    };

    return {
      datas: {
        id: this.code ?? 0,
        ot: this.ot ?? 0,
        alias: this.alias ?? 0,
        setcode: toSetcodeFromNumberArray(this.setcode ?? []),
        type,
        atk: attack,
        def: defense,
        level,
        race: this.race ?? 0,
        attribute: this.attribute ?? 0,
        category: this.category ?? 0,
      } satisfies CdbSqljsRowData,
      texts: {
        id: this.code ?? 0,
        name: this.name ?? '',
        desc: this.desc ?? '',
        str1: getString(0),
        str2: getString(1),
        str3: getString(2),
        str4: getString(3),
        str5: getString(4),
        str6: getString(5),
        str7: getString(6),
        str8: getString(7),
        str9: getString(8),
        str10: getString(9),
        str11: getString(10),
        str12: getString(11),
        str13: getString(12),
        str14: getString(13),
        str15: getString(14),
        str16: getString(15),
      } satisfies CdbSqljsRowText,
    };
  }
}
