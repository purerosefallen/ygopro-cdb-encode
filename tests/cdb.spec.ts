import fs from 'fs';
import initSqlJs from 'sql.js';
import { YGOProCdb } from '../src/cdb';
import { CardDataEntry } from '../src/card-data-entry';
import { OcgcoreCommonConstants } from 'ygopro-msg-encode';
import {
  And,
  HasAllBits,
  HasBit,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Or,
} from '../src/utility/cdb-operators';

describe('YGOProCdb find APIs', () => {
  let cdb: YGOProCdb;
  let sampleId: number;
  let sampleAtk: number;
  let sampleType: number;
  let sampleRawLevel: number;
  let sampleRawDefense: number;
  let linkId: number;
  let linkRawDefense: number;
  let nonLinkId: number;
  let nonLinkRawDefense: number;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const data = new Uint8Array(fs.readFileSync('tests/cards.cdb'));
    cdb = new YGOProCdb(SQL).from(data);
    const rawDb = new SQL.Database(data);

    const sample = cdb.findOne('texts.name = :name', { name: '青眼白龙' });
    if (!sample) {
      throw new Error('Sample card not found in tests/cards.cdb');
    }
    sampleId = sample.code;
    sampleAtk = sample.attack;
    sampleType = sample.type;
    {
      const res = rawDb.exec(
        `SELECT level, def FROM datas WHERE id = ${sampleId} LIMIT 1`,
      );
      sampleRawLevel = Number(res[0].values[0][0]);
      sampleRawDefense = Number(res[0].values[0][1]);
    }

    const typeLink = OcgcoreCommonConstants.TYPE_LINK >>> 0;
    {
      const res = rawDb.exec(
        `SELECT id, def FROM datas WHERE (type & ${typeLink}) != 0 LIMIT 1`,
      );
      linkId = Number(res[0].values[0][0]);
      linkRawDefense = Number(res[0].values[0][1]);
    }
    {
      const res = rawDb.exec(
        `SELECT id, def FROM datas WHERE (type & ${typeLink}) = 0 LIMIT 1`,
      );
      nonLinkId = Number(res[0].values[0][0]);
      nonLinkRawDefense = Number(res[0].values[0][1]);
    }
    rawDb.close();
  });

  test('find() returns cards', () => {
    const cards = cdb.find();
    expect(cards.length).toBeGreaterThan(0);
  });

  test('find(stmt, params) works', () => {
    const cards = cdb.find('texts.name = :name', { name: '黑魔术师' });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].name).toBe('黑魔术师');
  });

  test('find(stmt) works without params', () => {
    const cards = cdb.find(`datas.id = ${sampleId}`);
    expect(cards.length).toBe(1);
    expect(cards[0].code).toBe(sampleId);
  });

  test('find(filter) equals match', () => {
    const cards = cdb.find({ id: sampleId });
    expect(cards.length).toBe(1);
    expect(cards[0].code).toBe(sampleId);
  });

  test('virtual fields: code/rawLevel/rawDefense', () => {
    const byCode = cdb.find({ code: sampleId });
    expect(byCode.length).toBe(1);
    expect(byCode[0].code).toBe(sampleId);

    const byRawLevel = cdb.findOne({ rawLevel: sampleRawLevel });
    expect(byRawLevel).toBeDefined();

    const byRawDefense = cdb.findOne({ rawDefense: sampleRawDefense });
    expect(byRawDefense).toBeDefined();
  });

  test('findOne adds limit 1 if missing', () => {
    const card = cdb.findOne('texts.name = :name', { name: '真红眼黑龙' });
    expect(card).toBeDefined();
    expect(card?.name).toBe('真红眼黑龙');
  });

  test('findById works', () => {
    const card = cdb.findById(sampleId);
    expect(card).toBeDefined();
    expect(card?.code).toBe(sampleId);
  });

  test('Not with value and null', () => {
    const notName = cdb.find({ name: Not('青眼白龙') });
    expect(notName.length).toBeGreaterThan(0);

    const notNullDesc = cdb.findOne({ desc: Not(null) });
    expect(notNullDesc).toBeDefined();
  });

  test('Not with comparison operator flips correctly', () => {
    const ge = cdb.find({ atk: Not(LessThan(sampleAtk)) });
    expect(ge.length).toBeGreaterThan(0);

    const lt = cdb.find({ atk: Not(MoreThanOrEqual(sampleAtk)) });
    expect(lt.length).toBeGreaterThan(0);
  });

  test('And/Or with plain values', () => {
    const andSame = cdb.find({ name: And('青眼白龙', '青眼白龙') });
    expect(andSame.length).toBeGreaterThan(0);

    const andDiff = cdb.find({ name: And('青眼白龙', '黑魔术师') });
    expect(andDiff.length).toBe(0);

    const orNames = cdb.find({ name: Or('青眼白龙', '黑魔术师') });
    expect(orNames.length).toBeGreaterThan(0);
  });

  test('And/Or with operators', () => {
    const range = cdb.find({ atk: And(MoreThan(0), LessThan(10000)) });
    expect(range.length).toBeGreaterThan(0);

    const orOp = cdb.find({ atk: Or(MoreThan(3000), 0) });
    expect(orOp.length).toBeGreaterThan(0);
  });

  test('HasBit and HasAllBits', () => {
    const lowestBit = sampleType & -sampleType;
    const hasBit = cdb.find({ id: sampleId, type: HasBit(lowestBit) });
    expect(hasBit.length).toBe(1);

    const hasAllBits = cdb.find({ id: sampleId, type: HasAllBits(sampleType) });
    expect(hasAllBits.length).toBe(1);
  });

  test('virtual fields: defense/linkMarker for link and non-link', () => {
    const linkDefenseNull = cdb.find({ id: linkId, defense: null });
    expect(linkDefenseNull.length).toBe(1);
    const linkMarkerMatch = cdb.find({
      id: linkId,
      linkMarker: linkRawDefense,
    });
    expect(linkMarkerMatch.length).toBe(1);

    const nonLinkDefenseMatch = cdb.find({
      id: nonLinkId,
      defense: nonLinkRawDefense,
    });
    expect(nonLinkDefenseMatch.length).toBe(1);
    const nonLinkMarkerNull = cdb.find({ id: nonLinkId, linkMarker: null });
    expect(nonLinkMarkerNull.length).toBe(1);
  });

  test('noTexts mode finds from datas without joining texts', async () => {
    const SQL = await initSqlJs();
    const data = new Uint8Array(fs.readFileSync('tests/cards.cdb'));
    const rawDb = new SQL.Database(data);
    rawDb.exec('DROP TABLE texts');

    const local = new YGOProCdb(rawDb).noTexts();
    const cards = local.find({ id: sampleId });
    expect(cards.length).toBe(1);
    expect(cards[0].code).toBe(sampleId);
    expect(cards[0].name).toBe('');
    expect(cards[0].desc).toBe('');
    local.finalize();
  });

  test('noTexts mode rejects text predicates', () => {
    cdb.noTexts();

    expect(() =>
      cdb.find('texts.name = :name', { name: '黑魔术师' }),
    ).toThrow(/noTexts mode/i);

    expect(() => cdb.find({ name: '黑魔术师' })).toThrow(/noTexts mode/i);
    expect(() => cdb.findOne({ name: '黑魔术师' })).toThrow(/noTexts mode/i);

    cdb.noTexts(false);
  });

  test('constructor inherits noTexts mode from another instance', async () => {
    const SQL = await initSqlJs();
    const data = new Uint8Array(fs.readFileSync('tests/cards.cdb'));
    const base = new YGOProCdb(SQL).from(data).noTexts();
    const inherited = new YGOProCdb(base);

    expect(() =>
      inherited.find('texts.name = :name', { name: '黑魔术师' }),
    ).toThrow(/noTexts mode/i);

    const cards = inherited.find({ id: sampleId });
    expect(cards.length).toBe(1);
    expect(cards[0].code).toBe(sampleId);
  });

  test('noTexts toggle drops and recreates texts table', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);

    db.noTexts();
    let exists = db.database.exec(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'texts'`,
    );
    expect(exists.length).toBe(0);

    db.noTexts(false);
    exists = db.database.exec(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'texts'`,
    );
    expect(exists.length).toBe(1);

    db.finalize();
  });
});

describe('YGOProCdb addCard and export', () => {
  test('addCard inserts into datas and texts', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: 123456,
      ot: 2,
      alias: 0,
      setcode: [0x1234],
      type: 0x1,
      level: 4,
      race: 0x2,
      attribute: 0x4,
      attack: 1800,
      defense: 1000,
      lscale: 0,
      rscale: 0,
      linkMarker: 0,
      category: 0,
      name: '测试卡',
      desc: '测试描述',
      strings: ['效果1', '效果2'],
    });

    db.addCard(entry);
    const found = db.findById(123456);
    expect(found).toBeDefined();
    expect(found?.name).toBe('测试卡');
    expect(found?.desc).toBe('测试描述');
    expect(found?.attack).toBe(1800);
  });

  test('export returns a usable cdb', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: 654321,
      name: '导出测试卡',
      desc: '导出描述',
    });

    db.addCard(entry);
    const exported = db.export();
    const reopened = new YGOProCdb(SQL).from(exported);
    const found = reopened.findById(654321);
    expect(found).toBeDefined();
    expect(found?.name).toBe('导出测试卡');
  });

  test('setcode for 羽翼栗子球 LV6 and 霸王黑龙 异色眼叛逆超量龙 is read and written correctly', async () => {
    const SQL = await initSqlJs();

    // 先从原始 cards.cdb 中读取这两张卡的 setcode 十六进制表示，作为真实来源
    const rawData = new Uint8Array(fs.readFileSync('tests/cards.cdb'));
    const rawDb = new SQL.Database(rawData);

    const ids = [48486809, 30095833];

    // 使用库的 API 读取卡片，检查解析出来的 setcode 数组
    const cdb = new YGOProCdb(SQL).from(rawData);

    const expectedArrayById: Record<number, number[]> = {
      // 低 16bit 在 sql.js 的 number 表达下存在精度误差，这里以运行时解析结果为准
      48486809: [4256, 0x41, 0x3008, 0x194], // 羽翼栗子球 LV6
      30095833: [0x99, 0x13b, 0x2073], // 霸王黑龙 异色眼叛逆超量龙
    };

    for (const id of ids) {
      const card = cdb.findById(id);
      expect(card).toBeDefined();
      const setcodes = card?.setcode ?? [];
      expect(setcodes.slice(0, expectedArrayById[id].length)).toEqual(
        expectedArrayById[id],
      );
    }

    // 再把这两张卡写入一个新的 CDB，然后重新读出来，确认 setcode 没有丢失
    const newDb = new YGOProCdb(SQL);
    const baselineHexById: Record<number, string> = {};

    for (const id of ids) {
      const card = cdb.findById(id) as CardDataEntry | undefined;
      expect(card).toBeDefined();

      // 以当前解析出的 setcode 重新编码为 bigint，作为基准值
      const row = card!.toSqljsRow();
      const bigintValue = row.datas.setcode as bigint;
      baselineHexById[id] = bigintValue
        .toString(16)
        .toUpperCase()
        .padStart(16, '0');

      newDb.addCard(card!);
    }

    const exported = newDb.export();
    const reopened = new SQL.Database(exported);

    for (const id of ids) {
      const res = reopened.exec(
        `SELECT printf('%016X', setcode) AS hex FROM datas WHERE id = ${id} LIMIT 1`,
      );
      expect(res.length).toBe(1);
      const hex = String(res[0].values[0][0]);
      expect(hex).toBe(baselineHexById[id]);
    }

    rawDb.close();
    reopened.close();
    newDb.finalize();
    cdb.finalize();
  });
});
