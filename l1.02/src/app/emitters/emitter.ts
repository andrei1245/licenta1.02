import { EventEmitter } from "@angular/core"



export class Emitters {
    static authEmitter: EventEmitter<boolean> = new EventEmitter<boolean>();
}