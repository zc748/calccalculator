// State Management
let currentOperation = 'derivative';
let currentChart = null;

// DOM Elements
const operationBtns = document.querySelectorAll('.operation-btn');
const calculatorSections = document.querySelectorAll('.calculator-section');
const calculateBtns = document.querySelectorAll('.calculate-btn');
const exampleBtns = document.querySelectorAll('.example-btn');
const resultsContainer = document.getElementById('results-container');
const closeResultsBtn = document.getElementById('closeResults');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const integralTypeSelect = document.getElementById('integral-type');
const definiteInputs = document.getElementById('definite-inputs');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    showSection('derivative');
});

// Setup Event Listeners
function setupEventListeners() {
    // Operation switching
    operationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const operation = btn.dataset.operation;
            switchOperation(operation);
        });
    });

    // Calculate buttons
    calculateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const calcType = btn.dataset.calc;
            calculate(calcType);
        });
    });

    // Example buttons
    exampleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const example = e.target.dataset.example;
            const input = e.target.closest('.calculator-section').querySelector('.function-input');
            if (input) {
                input.value = example;
                input.focus();
            }
        });
    });

    // Close results
    if (closeResultsBtn) {
        closeResultsBtn.addEventListener('click', () => {
            resultsContainer.style.display = 'none';
        });
    }

    // Integral type change
    if (integralTypeSelect) {
        integralTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'definite') {
                definiteInputs.style.display = 'block';
            } else {
                definiteInputs.style.display = 'none';
            }
        });
    }

    // Enter key to calculate
    document.querySelectorAll('.function-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const section = e.target.closest('.calculator-section');
                const calcBtn = section.querySelector('.calculate-btn');
                if (calcBtn) calcBtn.click();
            }
        });
    });
}

// Switch Operation
function switchOperation(operation) {
    currentOperation = operation;
    
    // Update buttons
    operationBtns.forEach(btn => {
        if (btn.dataset.operation === operation) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update sections
    showSection(operation);
    
    // Hide results
    resultsContainer.style.display = 'none';
}

// Show Section
function showSection(operation) {
    calculatorSections.forEach(section => {
        if (section.id === `${operation}-section`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
}

// Calculate
async function calculate(type) {
    try {
        showLoading();
        hideError();
        
        const data = getCalculationData(type);
        
        if (!data.expression) {
            throw new Error('Please enter a function');
        }
        
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        hideLoading();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Calculation failed');
        }
        
        displayResults(result);
        
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

// Get Calculation Data
function getCalculationData(type) {
    const data = {
        operation: type,
        expression: document.getElementById(`${type}-input`).value,
        variable: document.getElementById(`${type}-variable`).value
    };
    
    if (type === 'derivative') {
        data.order = document.getElementById('derivative-order').value;
    }
    
    if (type === 'integral') {
        const integralType = document.getElementById('integral-type').value;
        data.definite = integralType === 'definite';
        if (data.definite) {
            data.lower = document.getElementById('integral-lower').value;
            data.upper = document.getElementById('integral-upper').value;
        }
    }
    
    if (type === 'limit') {
        data.point = document.getElementById('limit-point').value;
    }
    
    if (type === 'series') {
        data.point = document.getElementById('series-point').value;
        data.terms = document.getElementById('series-terms').value;
    }
    
    return data;
}

// Display Results
function displayResults(result) {
    const resultDisplay = document.getElementById('result-display');
    const stepsContainer = document.getElementById('steps-container');
    const graphContainer = document.getElementById('graph-container');
    
    // Clear previous results
    resultDisplay.innerHTML = '';
    stepsContainer.innerHTML = '';
    
    // Show results container
    resultsContainer.style.display = 'block';
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
    
    // Display result
    if (Array.isArray(result.result)) {
        const solutions = result.result.map(r => renderLatex(r)).join(', ');
        resultDisplay.innerHTML = `<div class="solutions-list">Solutions: ${solutions}</div>`;
    } else {
        resultDisplay.innerHTML = renderLatex(result.result);
    }
    
    // Display steps
    if (result.steps && result.steps.length > 0) {
        result.steps.forEach(step => {
            const stepEl = document.createElement('div');
            stepEl.className = 'step-item';
            stepEl.innerHTML = `
                <div class="step-title">${step.title}</div>
                <div class="step-expression">${renderLatex(step.expression)}</div>
                <div class="step-explanation">${step.explanation}</div>
            `;
            stepsContainer.appendChild(stepEl);
        });
    }
    
    // Display graph
    if (result.graph) {
        displayGraph(result.graph);
        graphContainer.style.display = 'block';
    } else {
        graphContainer.style.display = 'none';
    }
}

// Render LaTeX
function renderLatex(latex) {
    const container = document.createElement('span');
    try {
        katex.render(latex, container, {
            throwOnError: false,
            displayMode: false
        });
    } catch (e) {
        container.textContent = latex;
    }
    return container.outerHTML;
}

// Display Graph
function displayGraph(graphData) {
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart
    if (currentChart) {
        currentChart.destroy();
    }
    
    const datasets = [];
    
    if (graphData.original) {
        datasets.push({
            label: graphData.original.label,
            data: graphData.original.x.map((x, i) => ({ x, y: graphData.original.y[i] })),
            borderColor: '#4a9eff',
            backgroundColor: 'rgba(74, 158, 255, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
        });
    }
    
    if (graphData.derivative) {
        datasets.push({
            label: graphData.derivative.label,
            data: graphData.derivative.x.map((x, i) => ({ x, y: graphData.derivative.y[i] })),
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
        });
    }
    
    if (graphData.function) {
        datasets.push({
            label: graphData.function.label,
            data: graphData.function.x.map((x, i) => ({ x, y: graphData.function.y[i] })),
            borderColor: '#4ade80',
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4
        });
    }
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#e8eaed',
                        font: {
                            family: 'IBM Plex Mono',
                            size: 12
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'IBM Plex Mono'
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'IBM Plex Mono'
                        }
                    }
                }
            }
        }
    });
}

// Show Loading
function showLoading() {
    loading.style.display = 'block';
}

// Hide Loading
function hideLoading() {
    loading.style.display = 'none';
}

// Show Error
function showError(message) {
    const errorText = document.getElementById('error-text');
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Hide Error
function hideError() {
    errorMessage.style.display = 'none';
}

// Theme Toggle (optional)
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        // Could implement light theme here
        alert('Theme toggle - implement light theme if desired');
    });
}

// GitHub Button
const githubBtn = document.getElementById('githubBtn');
if (githubBtn) {
    githubBtn.addEventListener('click', () => {
        window.open('https://github.com/yourusername/calculus-calculator', '_blank');
    });
}
