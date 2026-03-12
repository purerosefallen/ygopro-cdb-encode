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

    expect(() => cdb.find('texts.name = :name', { name: '黑魔术师' })).toThrow(
      /noTexts mode/i,
    );

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

describe('YGOProCdb rule_code handling', () => {
  test('card with no alias has ruleCode = 0', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: 100001,
      alias: 0,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '普通卡',
    });

    db.addCard(entry);
    const found = db.findById(100001);
    expect(found).toBeDefined();
    expect(found?.alias).toBe(0);
    expect(found?.ruleCode).toBe(0);
  });

  test('card with non-alternative alias moves alias to ruleCode', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: 100050,
      alias: 100000,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '有别名的卡',
    });

    db.addCard(entry);
    const found = db.findById(100050);
    expect(found).toBeDefined();
    expect(found?.alias).toBe(0);
    expect(found?.ruleCode).toBe(100000);
  });

  test('alternative artwork card keeps alias and inherits ruleCode', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);

    const original = new CardDataEntry().fromPartial({
      code: 100010,
      alias: 0,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '原画卡',
    });

    const alternative = new CardDataEntry().fromPartial({
      code: 100015,
      alias: 100010,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '异画卡',
    });

    db.addCard([original, alternative]);
    const foundAlt = db.findById(100015);
    expect(foundAlt).toBeDefined();
    expect(foundAlt?.alias).toBe(100010);
    expect(foundAlt?.ruleCode).toBe(0);
  });

  test('special card 5405695 moves alias to ruleCode', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: 5405695,
      alias: 12345,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: 'Black Luster Soldier #2',
    });

    db.addCard(entry);
    const found = db.findById(5405695);
    expect(found).toBeDefined();
    expect(found?.alias).toBe(0);
    expect(found?.ruleCode).toBe(12345);
  });

  test('token cards do not process alias', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: 100003,
      alias: 99998,
      type:
        OcgcoreCommonConstants.TYPE_TOKEN | OcgcoreCommonConstants.TYPE_MONSTER,
      name: '衍生物',
    });

    db.addCard(entry);
    const found = db.findById(100003);
    expect(found).toBeDefined();
    expect(found?.alias).toBe(99998);
    expect(found?.ruleCode).toBe(0);
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
});
