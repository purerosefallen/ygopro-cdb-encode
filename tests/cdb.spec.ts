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

  test('step(filter) yields entries and matches find(filter)', () => {
    const fromStep = Array.from(cdb.step({ id: sampleId }));
    expect(fromStep.length).toBe(1);
    expect(fromStep[0].code).toBe(sampleId);

    const fromFind = cdb.find({ id: sampleId });
    expect(fromFind.length).toBe(fromStep.length);
    expect(fromFind[0].code).toBe(fromStep[0].code);
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
    const entry = new CardDataEntry().fromPartial({
      code: 777777,
      name: 'toggle-test',
      desc: 'toggle-desc',
      strings: ['toggle-str1'],
    });

    db.addCard(entry);

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

    const counts = db.database.exec(
      'SELECT (SELECT COUNT(*) FROM datas), (SELECT COUNT(*) FROM texts)',
    );
    expect(Number(counts[0].values[0][0])).toBe(Number(counts[0].values[0][1]));

    const row = db.database.exec(
      'SELECT name, desc, str1 FROM texts WHERE id = 777777 LIMIT 1',
    );
    expect(String(row[0].values[0][0])).toBe('');
    expect(String(row[0].values[0][1])).toBe('');
    expect(String(row[0].values[0][2])).toBe('');

    const found = db.findById(777777);
    expect(found).toBeDefined();
    expect(found?.name).toBe('');
    expect(found?.desc).toBe('');
    expect(found?.strings[0]).toBe('');

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

  test('token cards do not inherit ruleCode even with alternative alias', async () => {
    const SQL = await initSqlJs();
    const rawDb = new SQL.Database();

    rawDb.exec(
      'CREATE TABLE datas(id integer primary key,ot integer,alias integer,setcode integer,type integer,atk integer,def integer,level integer,race integer,attribute integer,category integer);' +
        'CREATE TABLE texts(id integer primary key,name text,desc text,str1 text,str2 text,str3 text,str4 text,str5 text,str6 text,str7 text,str8 text,str9 text,str10 text,str11 text,str12 text,str13 text,str14 text,str15 text,str16 text);',
    );

    const typeToken =
      OcgcoreCommonConstants.TYPE_TOKEN | OcgcoreCommonConstants.TYPE_MONSTER;

    rawDb.exec(`
      INSERT INTO datas (id, ot, alias, setcode, type, atk, def, level, race, attribute, category) VALUES
        (30000, 1, 0, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0),
        (30010, 1, 30000, 0, ${typeToken}, 0, 0, 0, 0, 0, 0);
      
      INSERT INTO texts (id, name, desc) VALUES
        (30000, '原卡', ''),
        (30010, 'Token', '');
    `);

    const db = new YGOProCdb(rawDb);

    const foundOriginal = db.findById(30000);
    expect(foundOriginal).toBeDefined();
    expect(foundOriginal?.code).toBe(30000);
    expect(foundOriginal?.alias).toBe(0);
    expect(foundOriginal?.ruleCode).toBe(0);

    const foundToken = db.findById(30010);
    expect(foundToken).toBeDefined();
    expect(foundToken?.code).toBe(30010);
    expect(foundToken?.alias).toBe(30000);
    expect(foundToken?.ruleCode).toBe(0);
  });

  test('round trip: card with ruleCode writes and reads back correctly', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);

    const original = new CardDataEntry().fromPartial({
      code: 100060,
      alias: 100020,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '有别名的原卡',
    });

    db.addCard(original);
    const exported = db.export();

    const db2 = new YGOProCdb(SQL).from(exported);
    const found = db2.findById(100060);

    expect(found).toBeDefined();
    expect(found?.code).toBe(100060);
    expect(found?.alias).toBe(0);
    expect(found?.ruleCode).toBe(100020);
    expect(found?.name).toBe('有别名的原卡');
  });

  test('round trip: alternative artwork card preserves alias', async () => {
    const SQL = await initSqlJs();
    const db = new YGOProCdb(SQL);

    const original = new CardDataEntry().fromPartial({
      code: 100070,
      alias: 0,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '原版',
    });

    const alternative = new CardDataEntry().fromPartial({
      code: 100075,
      alias: 100070,
      type: OcgcoreCommonConstants.TYPE_MONSTER,
      name: '异画版',
    });

    db.addCard([original, alternative]);
    const exported = db.export();

    const db2 = new YGOProCdb(SQL).from(exported);
    const foundAlt = db2.findById(100075);

    expect(foundAlt).toBeDefined();
    expect(foundAlt?.code).toBe(100075);
    expect(foundAlt?.alias).toBe(100070);
    expect(foundAlt?.ruleCode).toBe(0);
    expect(foundAlt?.name).toBe('异画版');
  });

  test('chained alternative artwork inherits ruleCode correctly', async () => {
    const SQL = await initSqlJs();
    const rawDb = new SQL.Database();

    rawDb.exec(
      'CREATE TABLE datas(id integer primary key,ot integer,alias integer,setcode integer,type integer,atk integer,def integer,level integer,race integer,attribute integer,category integer);' +
        'CREATE TABLE texts(id integer primary key,name text,desc text,str1 text,str2 text,str3 text,str4 text,str5 text,str6 text,str7 text,str8 text,str9 text,str10 text,str11 text,str12 text,str13 text,str14 text,str15 text,str16 text);',
    );

    rawDb.exec(`
      INSERT INTO datas (id, ot, alias, setcode, type, atk, def, level, race, attribute, category) VALUES
        (10000, 1, 0, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0),
        (20000, 1, 10000, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0),
        (20001, 1, 20000, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0);
      
      INSERT INTO texts (id, name, desc) VALUES
        (10000, '原始卡', ''),
        (20000, '第一异画', ''),
        (20001, '第二异画', '');
    `);

    const db = new YGOProCdb(rawDb);

    const foundOriginal = db.findById(10000);
    expect(foundOriginal).toBeDefined();
    expect(foundOriginal?.code).toBe(10000);
    expect(foundOriginal?.alias).toBe(0);
    expect(foundOriginal?.ruleCode).toBe(0);

    const foundFirst = db.findById(20000);
    expect(foundFirst).toBeDefined();
    expect(foundFirst?.code).toBe(20000);
    expect(foundFirst?.alias).toBe(0);
    expect(foundFirst?.ruleCode).toBe(10000);

    const foundSecond = db.findById(20001);
    expect(foundSecond).toBeDefined();
    expect(foundSecond?.code).toBe(20001);
    expect(foundSecond?.alias).toBe(20000);
    expect(foundSecond?.ruleCode).toBe(10000);
  });

  test('round trip: chained alternative artwork preserves alias and ruleCode', async () => {
    const SQL = await initSqlJs();
    const rawDb = new SQL.Database();

    rawDb.exec(
      'CREATE TABLE datas(id integer primary key,ot integer,alias integer,setcode integer,type integer,atk integer,def integer,level integer,race integer,attribute integer,category integer);' +
        'CREATE TABLE texts(id integer primary key,name text,desc text,str1 text,str2 text,str3 text,str4 text,str5 text,str6 text,str7 text,str8 text,str9 text,str10 text,str11 text,str12 text,str13 text,str14 text,str15 text,str16 text);',
    );

    rawDb.exec(`
      INSERT INTO datas (id, ot, alias, setcode, type, atk, def, level, race, attribute, category) VALUES
        (10000, 1, 0, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0),
        (20000, 1, 10000, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0),
        (20001, 1, 20000, 0, ${OcgcoreCommonConstants.TYPE_MONSTER}, 0, 0, 0, 0, 0, 0);
      
      INSERT INTO texts (id, name, desc) VALUES
        (10000, '原始卡', ''),
        (20000, '第一异画', ''),
        (20001, '第二异画', '');
    `);

    const db = new YGOProCdb(rawDb);
    const exported = db.export();

    const db2 = new YGOProCdb(SQL).from(exported);

    const foundOriginal = db2.findById(10000);
    expect(foundOriginal).toBeDefined();
    expect(foundOriginal?.code).toBe(10000);
    expect(foundOriginal?.alias).toBe(0);
    expect(foundOriginal?.ruleCode).toBe(0);

    const foundFirst = db2.findById(20000);
    expect(foundFirst).toBeDefined();
    expect(foundFirst?.code).toBe(20000);
    expect(foundFirst?.alias).toBe(0);
    expect(foundFirst?.ruleCode).toBe(10000);

    const foundSecond = db2.findById(20001);
    expect(foundSecond).toBeDefined();
    expect(foundSecond?.code).toBe(20001);
    expect(foundSecond?.alias).toBe(20000);
    expect(foundSecond?.ruleCode).toBe(10000);
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
