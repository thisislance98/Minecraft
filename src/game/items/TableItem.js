import { FurnitureItem } from './FurnitureItem.js';
import { Table } from '../entities/furniture/Table.js';

export class TableItem extends FurnitureItem {
    constructor() {
        super('table', 'Table', Table);
    }
}
