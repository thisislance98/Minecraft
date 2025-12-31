import { FurnitureItem } from './FurnitureItem.js';
import { Chair } from '../entities/furniture/Chair.js';

export class ChairItem extends FurnitureItem {
    constructor() {
        super('chair', 'Chair', Chair);
    }
}
