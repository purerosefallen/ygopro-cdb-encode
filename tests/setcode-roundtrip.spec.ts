import fs from 'fs';
import initSqlJs from 'sql.js';
import { YGOProCdb } from '../src/cdb';
import { CardDataEntry } from '../src/card-data-entry';

const BETB_CARD_FIXTURE_CDB = 'tests/fixtures/card-101306061.cdb';
const FOUR_FFFF_CARD_ID = 101306062;
const BETB_CARD_ID = 101306061;
const BETB_CARD_NAME = '无垢艺术-「黄昏之变幻」';
const BETB_CARD_SETCODE = [0x1cd, 0x1d2, 0x1d8, 0x2e6];
const BETB_CARD_SETCODE_HEX = '02E601D801D201CD';

function getStoredSetcode(db: YGOProCdb, id: number) {
  const res = db.database.exec(
    `SELECT typeof(setcode), CAST(setcode AS TEXT), printf('%016llX', setcode) FROM datas WHERE id = ${id} LIMIT 1`,
  );
  expect(res.length).toBe(1);
  const [type, decimal, hex] = res[0].values[0];
  return {
    type: String(type),
    decimal: String(decimal),
    hex: String(hex),
  };
}

describe('YGOProCdb setcode round trips', () => {
  test('round trips four 0xffff setcode chunks through export and reopen', async () => {
    const SQL = await initSqlJs();
    const source = new YGOProCdb(SQL);
    const entry = new CardDataEntry().fromPartial({
      code: FOUR_FFFF_CARD_ID,
      setcode: [0xffff, 0xffff, 0xffff, 0xffff],
      name: 'u64 setcode test',
    });

    source.addCard(entry);
    expect(getStoredSetcode(source, FOUR_FFFF_CARD_ID)).toEqual({
      type: 'integer',
      decimal: '-1',
      hex: 'FFFFFFFFFFFFFFFF',
    });

    const reopened = new YGOProCdb(SQL).from(source.export());
    const found = reopened.findById(FOUR_FFFF_CARD_ID);

    expect(found?.setcode).toEqual([0xffff, 0xffff, 0xffff, 0xffff]);
    expect(getStoredSetcode(reopened, FOUR_FFFF_CARD_ID)).toEqual({
      type: 'integer',
      decimal: '-1',
      hex: 'FFFFFFFFFFFFFFFF',
    });

    reopened.finalize();
    source.finalize();
  });

  test('round trips card 101306061 fixture through export and reopen', async () => {
    const SQL = await initSqlJs();
    const source = new YGOProCdb(SQL).from(
      new Uint8Array(fs.readFileSync(BETB_CARD_FIXTURE_CDB)),
    );
    const card = source.findById(BETB_CARD_ID);

    expect(card).toBeDefined();
    expect(card?.name).toBe(BETB_CARD_NAME);
    expect(card?.setcode).toEqual(BETB_CARD_SETCODE);
    expect(getStoredSetcode(source, BETB_CARD_ID)).toMatchObject({
      type: 'integer',
      decimal: '208856459974410701',
      hex: BETB_CARD_SETCODE_HEX,
    });

    const copied = new YGOProCdb(SQL);
    copied.addCard(card!);

    const reopened = new YGOProCdb(SQL).from(copied.export());
    const found = reopened.findById(BETB_CARD_ID);

    expect(found?.name).toBe(BETB_CARD_NAME);
    expect(found?.setcode).toEqual(BETB_CARD_SETCODE);
    expect(getStoredSetcode(reopened, BETB_CARD_ID)).toEqual({
      type: 'integer',
      decimal: '208856459974410701',
      hex: BETB_CARD_SETCODE_HEX,
    });

    reopened.finalize();
    copied.finalize();
    source.finalize();
  });
});
