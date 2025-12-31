import { FurnitureItem } from './FurnitureItem.js';
import { Couch } from '../entities/furniture/Couch.js';

export class CouchItem extends FurnitureItem {
    constructor() {
        super('couch', 'Couch', Couch);
    }
}
