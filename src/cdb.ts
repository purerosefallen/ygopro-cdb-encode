import { Database, SqlJsStatic } from 'sql.js';
import { isSqlJsStatic } from './utility/sqljs';
import { CardDataEntry } from './card-data-entry';
import { makeArray, MayBeArray } from 'nfkit';
import {
  CdbFindFilter,
  CdbSqljsParamKeys,
  CdbSqljsParamsFromStmt,
  CdbSqljsRow,
} from './types';
import { buildCdbFilterStmt, normalizeCdbParams } from './utility/cdb-filter';

const SELECT_STMT =
  'SELECT datas.id, datas.ot, datas.alias, datas.setcode, datas.type, datas.atk, datas.def, datas.level, datas.race, datas.attribute, datas.category,' +
  ' texts.name, texts.desc, texts.str1, texts.str2, texts.str3, texts.str4, texts.str5, texts.str6, texts.str7, texts.str8,' +
  ' texts.str9, texts.str10, texts.str11, texts.str12, texts.str13, texts.str14, texts.str15, texts.str16 FROM datas INNER JOIN texts ON datas.id = texts.id';

const CREATE_TABLE_STMT =
  'CREATE TABLE datas(id integer primary key,ot integer,alias integer,setcode integer,type integer,atk integer,def integer,level integer,race integer,attribute integer,category integer);' +
  'CREATE TABLE texts(id integer primary key,name text,desc text,str1 text,str2 text,str3 text,str4 text,str5 text,str6 text,str7 text,str8 text,str9 text,str10 text,str11 text,str12 text,str13 text,str14 text,str15 text,str16 text);';

const INSERT_DATAS_STMT =
  'INSERT OR REPLACE INTO datas(id,ot,alias,setcode,type,atk,def,level,race,attribute,category) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
const INSERT_TEXTS_STMT =
  'INSERT OR REPLACE INTO texts(id,name,desc,str1,str2,str3,str4,str5,str6,str7,str8,str9,str10,str11,str12,str13,str14,str15,str16) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

export class YGOProCdb {
  private db: Database;
  private SQL: SqlJsStatic | undefined;

  constructor(sqljsStaticOrDb: SqlJsStatic | Database | YGOProCdb) {
    if (sqljsStaticOrDb instanceof YGOProCdb) {
      this.SQL = sqljsStaticOrDb.SQL;
      this.db = sqljsStaticOrDb.db;
    } else if (isSqlJsStatic(sqljsStaticOrDb)) {
      this.SQL = sqljsStaticOrDb;
      this.db = new this.SQL.Database();
      this.db.exec(CREATE_TABLE_STMT);
    } else {
      this.SQL = undefined;
      this.db = sqljsStaticOrDb;
    }
  }

  get database() { 
    if (!this.db) { 
      if (!this.SQL) { 
        throw new Error('Database is not initialized and SqlJsStatic is not available');
      }
      this.db = new this.SQL.Database();
      this.db.exec(CREATE_TABLE_STMT);
    }
    return this.db;
  }

  fromDb(db: Database | Uint8Array) {
    if (this.db) {
      this.finalize();
    }
    if (db instanceof Uint8Array) {
      if (!this.SQL) {
        throw new Error(
          'SqlJsStatic is required to create a database from Uint8Array',
        );
      }
      this.db = new this.SQL.Database(db);
    } else {
      this.db = db;
    }
    return this;
  }

  addCard(card: MayBeArray<CardDataEntry>) {
    const cards = makeArray(card);
    const stmtDatas = this.database.prepare(INSERT_DATAS_STMT);
    const stmtTexts = this.database.prepare(INSERT_TEXTS_STMT);
    const toSqlValueSetcode = (value: number | bigint) => {
      if (typeof value !== 'bigint') {
        return value;
      }
      if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(value);
      }
      return value.toString();
    };
    try {
      for (const c of cards) {
        const row = c.toSqljsRow();
        const datas = row.datas;
        const texts = row.texts;
        stmtDatas.run([
          datas.id,
          datas.ot,
          datas.alias,
          toSqlValueSetcode(datas.setcode),
          datas.type,
          datas.atk,
          datas.def,
          datas.level,
          datas.race,
          datas.attribute,
          datas.category,
        ]);
        stmtTexts.run([
          texts.id,
          texts.name,
          texts.desc,
          texts.str1,
          texts.str2,
          texts.str3,
          texts.str4,
          texts.str5,
          texts.str6,
          texts.str7,
          texts.str8,
          texts.str9,
          texts.str10,
          texts.str11,
          texts.str12,
          texts.str13,
          texts.str14,
          texts.str15,
          texts.str16,
        ]);
      }
    } finally {
      stmtDatas.free();
      stmtTexts.free();
    }
    return this;
  }

  find<S extends string>(
    stmt: S,
    params: CdbSqljsParamsFromStmt<S>,
  ): CardDataEntry[];
  find<S extends string>(
    stmt: S,
  ): CdbSqljsParamKeys<S> extends never ? CardDataEntry[] : never;
  find(filter: CdbFindFilter): CardDataEntry[];
  find(): CardDataEntry[];
  find(...args) {
    let stmt = '';
    let params: Record<string, any> = {};

    if (args.length === 0) {
      stmt = '';
    } else if (typeof args[0] === 'string') {
      stmt = args[0];
      params = args[1] ?? {};
    } else {
      const filter = args[0] as CdbFindFilter;
      const built = buildCdbFilterStmt(filter);
      stmt = built.stmt;
      params = built.params;
    }

    const where = stmt ? ` WHERE ${stmt}` : '';
    const sql = `${SELECT_STMT}${where}`;
    const query = this.database.prepare(sql);
    const results: CardDataEntry[] = [];
    try {
      query.bind(normalizeCdbParams(params));
      while (query.step()) {
        const row = query.getAsObject() as unknown as CdbSqljsRow;
        results.push(new CardDataEntry().fromSqljsRow(row));
      }
    } finally {
      query.free();
    }
    return results;
  }

  findOne<S extends string>(
    stmt: S,
    params: CdbSqljsParamsFromStmt<S>,
  ): CardDataEntry | undefined;
  findOne<S extends string>(
    stmt: S,
  ): CdbSqljsParamKeys<S> extends never ? CardDataEntry | undefined : never;
  findOne(filter: CdbFindFilter): CardDataEntry | undefined;
  findOne(): CardDataEntry | undefined;
  findOne(...args) {
    if (args.length === 0) {
      return this.find('1=1 LIMIT 1')[0];
    }
    if (typeof args[0] === 'string') {
      const base = args[0];
      const params = args[1];
      const stmt = /\blimit\b/i.test(base) ? base : `${base} LIMIT 1`;
      return (
        this.find as unknown as (
          statement: string,
          parameters?: Record<string, any>,
        ) => CardDataEntry[]
      )(stmt, params as Record<string, any>)[0];
    }
    const filter = args[0] as CdbFindFilter;
    const built = buildCdbFilterStmt(filter);
    const stmt = built.stmt ? `${built.stmt} LIMIT 1` : '1=1 LIMIT 1';
    return this.find(stmt, built.params)[0];
  }

  findById(id: number) {
    return this.findOne('datas.id = :id', { id });
  }

  export() {
    return this.database.export();
  }

  finalize() {
    this.database.close();
    this.db = undefined;
  }
}
