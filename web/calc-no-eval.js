/**************************************************************************\
    Simulation program for world's first handheld calculator
    SHARP QT-8D/QT-8B 
    Author:  Takahiro Fujiwara
    Date:    2023-Oct-18
\**************************************************************************/

const calc_sts = Object.freeze( {
    poweroff:0,         // 
    initial: 1,         // 0.0.0.0.0.0.0.0.-
    clickC1: 2,         // 0.0 0 0 0 0 0 0 -
    normal:  3,         // 0 0 0 0 0 0 0 0
    destroy: 4          // @ @ @ @ @ @ @ @ ・
} );
const calc_entry_sts = Object.freeze( {
    newEntry: 11,       // replace digit to the number string
    inEntry:  12,       // add one digit to the number string
} );
const calc_ope_codes = Object.freeze( { // for last operation code. especially ×÷
    clear:    21,       // C button
    minus_eq: 22,       // −= button
    mul_div:  23,       // ×÷ button
    pul_eq:   24        // += button
});
const calc_operand_sts = Object.freeze( {   // entering phase especially ×÷
    inOpe1:  31,        // in operand 1
    inOpe2:  32         // in operand 2
});
const calc_prev_sts = Object.freeze( {
    clr:     40,
    ope:     41,
    num:     42
})
const calc_overflowchars = Object.freeze( { // char for layer 1 (upper layer) */
    normal:   ' ',
    overflow: '^'
})
const calc_minuschars = Object.freeze( {    // char for layer 0 (lower layer) */
    normal:   ' ',
    minus: '-'
})
const calc_messages = Object.freeze( {
    initializing:   "Initializing ...",
    after_poweron:  "Press the [C] button twice, to reset the system after power on.",
    C_pressed_once: "Press the [C] button onece more!!  To reset the system.",
    ready:          "Ready.",
    sound_ready:    "Sound is ready.<br />\t\tPress the [C] button twice, to reset the system after power on.",
})

function isDigit(n) {
    return /^\d$/.test(n);
}

class display {
    constructor() {
            }
    #strDisplay(str) {
        // create layered display string "0.1" -> "01" and ". "
        let dotstr = "";  /* for period */
        let numstr = "";  /* numbers */
        let dotc = "";
        let dotstr_lastDigit; 
        let numstr_lastDigit;
        for ( let c of str ) {
            if ( c == '.' ) {
                dotc = ".";
            } else {
                dotstr += dotc;
                numstr += c;
                dotc = " ";
            }
        }
        dotstr += dotc;
        dotstr_lastDigit = dotstr.substring(8).includes( calc_overflowchars.overflow )? calc_overflowchars.overflow: ' ';
        numstr_lastDigit = numstr.substring(8).includes( calc_minuschars.minus )? '-': ' ';
        dotstr = dotstr.substring(0, 8);
        numstr = numstr.substring(0, 8);
        
        document.getElementById("display0").value = dotstr + dotstr_lastDigit;
        document.getElementById("display1").value = numstr + numstr_lastDigit;
        console.log("display=["+str + "]");
    }
    print(status, param) {
        switch ( status ) {
            case calc_sts.poweroff:
                this.#strDisplay("");
                break;
            case calc_sts.initial:
                this.#strDisplay("0.0.0.0.0.0.0.0.-");
                break;
            case calc_sts.clickC1:
                this.#strDisplay("0.0000000-");
                break;
            case calc_sts.normal:
                this.#strDisplay( param.toString() );
                break;
            case calc_sts.destroy:
            default:
        }
    }
}

class register {
    #regName;
    inDecimal;
    decimalRight;   // 0: no decimal places.  1: one decimal place (0.0, 0.1)     2: two decimal places (0.00, 0.01, 0.12)
    decimalShow;    // true: show point mark.   false: do not show (when dot_pos=0)
    #value;         // number in double
    #valueNumDigit;
    #valueLstDigit;
    constructor(name) {
        this.#regName = name;
        this.clr();
    }
    clr () {
        this.inDecimal = false;
        this.decimalRight = 0;
        this.decimalShow = true;
        this.#value = 0;
        this.#valueNumDigit = "00000000";
        this.#valueLstDigit = " ";
    }
    copyFrom (reg) {
        this.inDecimal = reg.inDecimal;
        this.decimalRight = reg.decimalRight;
        this.decimalShow = reg.decimalShow;
        this.#value = reg.getNumber();
        this.#valueNumDigit = reg.getNumDigit();
        this.#valueLstDigit = reg.getLstDigit();
    }
    // when ==0, display will be no decimal point or possibility of 0000.0000 depends on decimalDigits
    // when !=0, display has always decimal point in somewhere, depends on decimalDigits
    set ( numStr ) {   // integer, floating number, -1.23 10 -0 -0.
        let num; let numabs;
        let lastDigit;
        num = parseFloat(numStr);
        if ( num == "NaN" ) {    // Not a Number
            num = 0;
        }
        if ( num < 0 || numStr.toString().substring(0,1)=='-' ) {
            lastDigit = "-";
            numabs = -num;
        } else {
            lastDigit = " ";
            numabs = num;
        }
        this.#value = num;
        console.log(this.#regName + ": set(" + numStr + ") num=" +num + " lastDigit=[" + lastDigit + "]");
        if ( Number.isInteger(num) ) {      // integer
            this.#valueNumDigit = numabs.toString().padStart(8, "0") + "."
            this.#value += ".";
        } else {
            if ( Number.isFinite(num) ) {   // has decimal fraction
                this.#valueNumDigit = numabs.toString().padStart(9, "0");   // 8+len of (.) =  9
            } else {                        // infinite number
                this.#valueNumDigit = "0.0.0.0.0.0.0.0.";
            }
        }
        this.#valueLstDigit = lastDigit;
        this.setValueFromNumLst();
        return this;
    }
    setNumDigit ( str ) {
        if ( !(str.toString().includes(".")) ) {
            str += ".";
        }
        this.#valueNumDigit = str.toString().padStart(9, "0");
        this.setValueFromNumLst();
        return this;
    }
    setLstDigit ( str ) {
        this.#valueLstDigit = str;
        this.setValueFromNumLst();
        return this;
    }
    invLstDigit () { // inverse - sign
        if ( this.#valueLstDigit.toString().includes("-") ) {
            this.#valueLstDigit = " " + this.#valueLstDigit.toString().replace(/-/g, '');   // replace "-" to " "
        } else {
            this.#valueLstDigit = "-" + this.#valueLstDigit.toString().replace(/ /g, '');   // replace " " to "-"
        }
        this.setValueFromNumLst();
        return this;
    }
    setValueFromNumLst() {     // setValue from NumDigit, LstDigit
        let num;
        num = parseFloat(this.#valueNumDigit);
        if ( num == "NaN" ) {    // Not a Number
            num = 0;
        }
        if ( this.#valueLstDigit.toString().includes("-") ) {
            this.#value = -num;
        } else {
            this.#value = num;
        }
        return this;
    }
    getNumDigit () {
        return this.#valueNumDigit;
    }
    getLstDigit () {
        return this.#valueLstDigit;
    }
    getStr() {
        return this.#valueNumDigit.toString() + this.#valueLstDigit.toString();
    }
    getNumber () {
        return this.#value;
    }
}

class sound {
    #audio = {};
    #vSlider;
    #initializeCounter = 0;
    constructor (vSlider) {
        this.#vSlider = document.getElementById('id_vSlider');
        this.#vSlider.disabled = true;
        //              keyTop, sound_file
        this.initialize( "0",       "./sounds/keymove4.mp3" );
        this.initialize( "1",       "./sounds/keymove12.mp3" );
        this.initialize( "2",       "./sounds/keymove12.mp3" );
        this.initialize( "3",       "./sounds/keymove12.mp3" );
        this.initialize( "4",       "./sounds/keymove12.mp3" );
        this.initialize( "5",       "./sounds/keymove12.mp3" );
        this.initialize( "6",       "./sounds/keymove12.mp3" );
        this.initialize( "7",       "./sounds/keymove12.mp3" );
        this.initialize( "8",       "./sounds/keymove12.mp3" );
        this.initialize( "9",       "./sounds/keymove12.mp3" );
        this.initialize( ".",       "./sounds/keymove4.mp3" );
        this.initialize( "C",       "./sounds/enter31.mp3" );
        this.initialize( "-",       "./sounds/enter38.mp3" );
        this.initialize( "*",       "./sounds/enter32.mp3" );
        this.initialize( "+",       "./sounds/enter38.mp3" );
        this.initialize( "\u232b",  "./sounds/keymove4.mp3" );
    }
    initialize ( key, filename ) {
        this.#initializeCounter++;
        this.#audio[key] = new Audio(filename);
        this.#audio[key].addEventListener("canplaythrough", this.canPlayThrough.bind(this), false);
    }
    canPlayThrough() {
        --this.#initializeCounter;
        if ( this.#initializeCounter == 0 ) {
            this.#vSlider.disabled = false;
            msg.print(calc_messages.sound_ready);
        }
    }
    play ( key ) {
        this.#audio[key].volume = this.#vSlider.value;
        this.#audio[key].play();
    }
}

class key {
    elementId;
    keyTop;
    function;
    constructor (elementId, keyTop, funcName) {
        this.elementId = elementId;
        this.keyTop = keyTop;
        this.function = funcName;
        if ( elementId != "" ) {
            // same as button:hover
            document.getElementById(elementId).addEventListener("mouseover", function() {
                this.style.backgroundColor = "rgba(var(--opacity-base-colorR), var(--opacity-base-colorG), var(--opacity-base-colorB), var(--opacity-level-hover))";
            });
            document.getElementById(elementId).addEventListener("mouseleave", function() {
                this.style.backgroundColor = "rgba(var(--opacity-base-colorR), var(--opacity-base-colorG), var(--opacity-base-colorB), var(--opacity-level-idle))";
            });
            // same as button:active
            document.getElementById(elementId).addEventListener("mousedown", function() {
                this.style.backgroundColor = "rgba(var(--opacity-base-colorR), var(--opacity-base-colorG), var(--opacity-base-colorB), var(--opacity-level-active))";
            });
            document.getElementById(elementId).addEventListener("mouseup", function() {
                this.style.backgroundColor = "rgba(var(--opacity-base-colorR), var(--opacity-base-colorG), var(--opacity-base-colorB), var(--opacity-level-idle))";
            });
        }
    }
}

class message {
    #element;
    constructor(elementId) {
        this.#element = document.getElementById("id_message")
    }
    print(str) {
        this.#element.innerHTML = "\t" + str;
    }
}


class calculator {
    #reg_a; #reg_b;
    #calc_st;
    #calc_entry_st;
    #calc_prev_st;
    #prev_op;
    #inputStr;
    #sound_instance;
    #disp;
    #key = {};
    constructor () {
        // initialize message area
        msg.print(calc_messages.initializing);
        // initialize register and status
        this.#reg_a = new register("reg_a");
        this.#reg_b = new register("reg_b");
        this.#calc_st = calc_sts.initial;
        this.#calc_entry_st = calc_entry_sts.newEntry;
        this.#calc_prev_st = calc_prev_sts.clr;
        // initialize display
        this.#disp = new display();
        this.#disp.print( this.#calc_st, "" );
        // initialize sound
        this.#sound_instance = new sound();
        // initialize key
        //  get elementId, ... from key(elementId, keyTop, function
        this.#key["0"] =        new key("D0",       "0",    this.NumberPushed.bind(this));
        this.#key["1"] =        new key("D1",       "1",    this.NumberPushed.bind(this));
        this.#key["2"] =        new key("D2",       "2",    this.NumberPushed.bind(this));
        this.#key["3"] =        new key("D3",       "3",    this.NumberPushed.bind(this));
        this.#key["4"] =        new key("D4",       "4",    this.NumberPushed.bind(this));
        this.#key["5"] =        new key("D5",       "5",    this.NumberPushed.bind(this));
        this.#key["6"] =        new key("D6",       "6",    this.NumberPushed.bind(this));
        this.#key["7"] =        new key("D7",       "7",    this.NumberPushed.bind(this));
        this.#key["8"] =        new key("D8",       "8",    this.NumberPushed.bind(this));
        this.#key["9"] =        new key("D9",       "9",    this.NumberPushed.bind(this));
        this.#key["."] =        new key("point",    ".",    this.NumberPushed.bind(this));
        this.#key["C"] =        new key("C",        "C",    this.ClearPushed.bind(this));
        this.#key["-"] =        new key("min",      "-",    this.OperatorPushed.bind(this));
        this.#key["*"] =        new key("mul",      "*",    this.OperatorPushed.bind(this));
        this.#key["+"] =        new key("pls",      "+",    this.OperatorPushed.bind(this));
        this.#key["ESCAPE"] =   new key("C",        "C",    this.ClearPushed.bind(this));
        this.#key["DELETE"] =   new key("C",        "C",    this.ClearPushed.bind(this));
        this.#key["/"] =        new key("mul",      "*",    this.OperatorPushed.bind(this));
        this.#key["="] =        new key("pls",      "+",    this.OperatorPushed.bind(this));
        this.#key[" "] =        new key("pls",      "+",    this.OperatorPushed.bind(this));
        this.#key["ENTER"] =    new key("pls",      "+",    this.OperatorPushed.bind(this));
        this.#key["BACKSPACE"] =new key("",    "\u232b",    this.BackspacePushed.bind(this));
        window.addEventListener("keydown", this.keyDown.bind(this), false );
        window.addEventListener("keyup", this.keyUp.bind(this), false );
        msg.print(calc_messages.after_poweron);
    }
    keyDown(e) {
        let k = e.key.toUpperCase();
        if ( !(this.#key[k] === undefined) ) {
            if ( this.#key[k].elementId != "" ) {
                document.getElementById(this.#key[k].elementId).style.backgroundColor =
                "rgba(var(--opacity-base-colorR), var(--opacity-base-colorG), var(--opacity-base-colorB), var(--opacity-level-active))";
            }
            this.#key[k].function( this.#key[k].keyTop );
            e.preventDefault(); 
        }
    }
    keyUp(e) {
        let k = e.key.toUpperCase();
        if ( !(this.#key[k] === undefined) ) {
            if ( this.#key[k].elementId !="" ) {
                document.getElementById(this.#key[k].elementId).style.backgroundColor =
                "rgba(var(--opacity-base-colorR), var(--opacity-base-colorG), var(--opacity-base-colorB), var(--opacity-level-idle))";
            }
        }
    }
    ClearPushed(key) {
        console.log("[C]");
        this.#sound_instance.play("C");
        switch ( this.#calc_st ) {
            case calc_sts.poweroff:
                this.#calc_st = calc_sts.initial;
                break;
            case calc_sts.initial:
                this.#calc_st = calc_sts.clickC1;
                msg.print(calc_messages.C_pressed_once);
                break;
            case calc_sts.clickC1:
                this.#calc_st = calc_sts.normal;
                msg.print(calc_messages.ready);
                break;
            default:
                break;
        }
        this.#reg_b.clr();
        if ( this.#calc_prev_st != calc_prev_sts.num ) {
            this.#reg_a.clr();
        } else {
        }
        this.#disp.print( this.#calc_st, this.#reg_a.getStr());
        this.#calc_entry_st = calc_entry_sts.newEntry;
        this.#calc_prev_st = calc_prev_sts.clr; // save for clear command
    }
    OperatorPushed(new_op) {
        console.log("[" + new_op + "]");
        this.#sound_instance.play(new_op);
        switch(new_op) {
            case '-':       // -=
                if ( this.#calc_prev_st=='*' ) { // high priority
                    this.#disp.print( this.#calc_st, this.#reg_a.set( 0 - parseFloat(this.#reg_a.getNumber()) ).getStr() );
                    return;
                } else if ( this.#calc_prev_st==calc_prev_sts.num ) {
                    if ( this.#prev_op == '*' ) { // divide now
                        console.log("calc: " + this.#reg_a.getNumber() +  " / " + this.#reg_b.getNumber());
                        this.#reg_a.set( parseFloat(this.#reg_a.getNumber()) / parseFloat(this.#reg_b.getNumber()) + 0.00000000000001 );
                    } else {
                        console.log("calc: " + this.#reg_a.getNumber() +  " - " + this.#reg_b.getNumber());
                        this.#reg_a.set( parseFloat(this.#reg_a.getNumber()) - parseFloat(this.#reg_b.getNumber()) );
                    }
                 } else {
                    this.#reg_a.invLstDigit();
                }
                this.#reg_b.copyFrom( this.#reg_a );
                this.#disp.print( this.#calc_st, this.#reg_a.getStr() );
                break;
            case '*':       // ×÷
                this.#reg_a.copyFrom(this.#reg_b);
                break;
            case '+':       // +=
                if ( this.#calc_prev_st=='*' ) { // high priority
                    this.#disp.print( this.#calc_st, this.#reg_a.set( 0 + parseFloat(this.#reg_a.getNumber()) ).getStr() );
                    return;
                } else if ( this.#calc_prev_st==calc_prev_sts.num ) {
                    if ( this.#prev_op == '*' ) { // multiply now
                        console.log("calc: " + this.#reg_a.getNumber() +  " * " + this.#reg_b.getNumber());
                        this.#reg_a.set( parseFloat(this.#reg_a.getNumber()) * parseFloat(this.#reg_b.getNumber()) );
                    } else {
                        console.log("calc: " + this.#reg_a.getNumber() +  " + " + this.#reg_b.getNumber());
                        this.#reg_a.set( parseFloat(this.#reg_a.getNumber()) + parseFloat(this.#reg_b.getNumber()) );
                    }
                } else {
                    this.#reg_a.set( parseFloat(this.#reg_a.getNumber()) );
                }
                this.#reg_b.copyFrom( this.#reg_a );
                this.#disp.print( this.#calc_st, this.#reg_a.getStr() );
                break;
            default:
                break;
        }
        this.#calc_entry_st = calc_entry_sts.newEntry;
        this.#prev_op = new_op;         // save for next
        this.#calc_prev_st = new_op;    // save for clear command
    }
    NumberPushed(number) {
        this.#sound_instance.play(number);
        if ( this.#calc_st == calc_sts.normal ) {
            if ( this.#calc_entry_st == calc_entry_sts.newEntry ) {
                this.#calc_entry_st = calc_entry_sts.inEntry;
                this.#inputStr = number;
            } else {
                if ( number == "." ) {
                    if ( this.#inputStr.includes(".") ) {
                        return;
                    }
                }
                this.#inputStr += number.toString();
                this.#inputStr = this.#inputStr.substring(0, this.#inputStr.includes(".")? 9: 8 );
            }
            this.#reg_b.setNumDigit( this.#inputStr );
            this.#disp.print( this.#calc_st, this.#reg_b.getStr() );
        }
        this.#calc_prev_st = calc_prev_sts.num; // save for clear command
    }
    BackspacePushed(key) {
        // this function is not supported in the real QT-8B!!
        if ( this.#calc_st == calc_sts.normal ) {
            if ( this.#calc_entry_st == calc_entry_sts.newEntry ) {
                // same as clear button
                this.ClearPushed();
            } else {
                // backspace one key
                this.#sound_instance.play(key);
                this.#inputStr = this.#inputStr.toString().slice(0,-1);
                this.#reg_b.setNumDigit( this.#inputStr );
                this.#disp.print( this.#calc_st, this.#reg_b.getStr() );
            }
        }
    }
}

function NumberPushed(number) {
    calc.NumberPushed(number);
}

function OperatorPushed(op) {
    calc.OperatorPushed(op);
}

function ClearPushed() {
    calc.ClearPushed("C");
}

const msg = new message();
const calc = new calculator();