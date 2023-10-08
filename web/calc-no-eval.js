let currentInput = "";
let operator = null;
let firstOperand = null;
let secondOperand = null;

function appendNumber(number) {
    currentInput = currentInput.toString() + number.toString();
    updateDisplay();
}

function appendOperator(op) {
    if (currentInput === "") return;
    if (operator !== null) calculate();
    firstOperand = currentInput;
    operator = op;
    currentInput = "";
}

function updateDisplay() {
    document.getElementById("display").value = currentInput;
}

function calculate() {
    if (operator === null || firstOperand === null) return;
    secondOperand = currentInput;
    switch (operator) {
        case '+':
            currentInput = parseFloat(firstOperand) + parseFloat(secondOperand);
            break;
        case '-':
            currentInput = parseFloat(firstOperand) - parseFloat(secondOperand);
            break;
        case '*':
            currentInput = parseFloat(firstOperand) * parseFloat(secondOperand);
            break;
        case '/':
            currentInput = parseFloat(firstOperand) / parseFloat(secondOperand);
            break;
        default:
            return;
    }
    operator = null;
    firstOperand = null;
    secondOperand = null;
    updateDisplay();
}

function clearDisplay() {
    currentInput = "";
    operator = null;
    firstOperand = null;
    secondOperand = null;
    updateDisplay();
}
