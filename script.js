document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const form = document.getElementById('predictionForm');
    const resultsDiv = document.getElementById('results');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const riskFactorsDiv = document.getElementById('riskFactors');
    let mortalityChart = null;
    let severityChart = null;

    // Inicializar gráficos
    const mortalityCtx = document.getElementById('mortalityChart').getContext('2d');
    const severityCtx = document.getElementById('severityChart').getContext('2d');
    
    // Configuración de gráficos
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    padding: 20,
                    font: {
                        weight: '600'
                    }
                }
            }
        }
    };

    // Manejar envío del formulario
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }
        
        // Mostrar indicador de carga
        loadingIndicator.classList.remove('d-none');
        resultsDiv.innerHTML = '';
        riskFactorsDiv.innerHTML = '';
        
        // Obtener datos del formulario
        const patientData = {
            age: parseInt(document.getElementById('age').value),
            blood_pressure: parseInt(document.getElementById('blood_pressure').value),
            heart_rate: parseInt(document.getElementById('heart_rate').value),
            oxygen_level: parseInt(document.getElementById('oxygen_level').value),
            chronic_conditions: parseInt(document.getElementById('chronic_conditions').value)
        };
        
        // Enviar datos al backend
        fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(patientData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                displayResults(data, patientData);
            } else {
                showError(data.message || 'Error desconocido');
            }
        })
        .catch(error => {
            showError(`Error de conexión: ${error.message}`);
        })
        .finally(() => {
            loadingIndicator.classList.add('d-none');
        });
    });

    function displayResults(data, patientData) {
        const mortalityPercent = (data.mortality_probability * 100).toFixed(1);
        const severityLevel = data.severity_level;
        
        // Calcular factores de riesgo individuales
        const riskFactors = calculateRiskFactors(patientData);
        
        // Determinar nivel de riesgo
        let riskLevel, riskClass;
        if (data.mortality_probability < 0.3) {
            riskLevel = "Bajo Riesgo";
            riskClass = "low-risk";
        } else if (data.mortality_probability < 0.7) {
            riskLevel = "Riesgo Moderado";
            riskClass = "medium-risk";
        } else {
            riskLevel = "Alto Riesgo";
            riskClass = "high-risk";
        }
        
        // Mostrar resultados principales
        resultsDiv.innerHTML = `
            <div class="animate-fade-in">
                <h3 class="risk-indicator ${riskClass} mb-4">${riskLevel}</h3>
                <div class="row">
                    <div class="col-md-6">
                        <div class="card bg-light mb-3">
                            <div class="card-body text-center">
                                <h6 class="text-muted mb-3">Probabilidad de Mortalidad</h6>
                                <h2 class="${riskClass}">${mortalityPercent}%</h2>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card bg-light mb-3">
                            <div class="card-body text-center">
                                <h6 class="text-muted mb-3">Nivel de Severidad</h6>
                                <span class="severity-indicator severity-${severityLevel}">Nivel ${severityLevel}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Actualizar gráficos
        updateCharts(data.mortality_probability, severityLevel);
        
        // Mostrar factores de riesgo
        displayRiskFactors(riskFactors);
        
        // Mostrar recomendaciones
        displayRecommendations(data.mortality_probability, severityLevel);

        // Guardar la evaluación en el histórico
        fetch('http://localhost:5000/save_evaluation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                patient_data: patientData,
                results: data
            })
        }).catch(error => console.error('Error guardando evaluación:', error));
    }
    
    function calculateRiskFactors(patientData) {
        // Calcular puntuaciones de riesgo individuales
        const ageRisk = Math.min(patientData.age / 100, 1);
        const bpRisk = patientData.blood_pressure > 140 ? 
            Math.min((patientData.blood_pressure - 140) / 60, 1) : 0;
        const oxyRisk = patientData.oxygen_level < 95 ? 
            Math.min((95 - patientData.oxygen_level) / 25, 1) : 0;
        const chronicRisk = patientData.chronic_conditions / 5;
        
        return {
            age: { value: patientData.age, risk: ageRisk, label: 'Edad' },
            blood_pressure: { value: patientData.blood_pressure, risk: bpRisk, label: 'Presión Arterial' },
            oxygen_level: { value: patientData.oxygen_level, risk: oxyRisk, label: 'Oxígeno en Sangre' },
            chronic_conditions: { value: patientData.chronic_conditions, risk: chronicRisk, label: 'Condiciones Crónicas' }
        };
    }
    
    function updateCharts(mortalityProb, severityLevel) {
        // Gráfico de mortalidad
        if (mortalityChart) mortalityChart.destroy();
        mortalityChart = new Chart(mortalityCtx, {
            type: 'doughnut',
            data: {
                labels: ['Probabilidad', 'Restante'],
                datasets: [{
                    data: [mortalityProb * 100, 100 - (mortalityProb * 100)],
                    backgroundColor: [
                        getRiskColor(mortalityProb),
                        '#e9ecef'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                ...chartOptions,
                plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
        
        // Gráfico de severidad
        if (severityChart) severityChart.destroy();
        severityChart = new Chart(severityCtx, {
            type: 'bar',
            data: {
                labels: ['Nivel de Severidad'],
                datasets: [{
                    label: `Nivel ${severityLevel}`,
                    data: [severityLevel],
                    backgroundColor: getSeverityColor(severityLevel),
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                ...chartOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 5,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                indexAxis: 'y'
            }
        });
    }
    
    function displayRiskFactors(factors) {
        let html = '<div class="row g-3">';
        
        for (const [key, factor] of Object.entries(factors)) {
            const riskPercent = (factor.risk * 100).toFixed(0);
            const riskColor = getRiskColor(factor.risk);
            
            html += `
                <div class="col-md-6">
                    <div class="risk-factor-item animate-fade-in" style="animation-delay: ${0.1 * Object.keys(factors).indexOf(key)}s">
                        <div class="risk-factor-name">
                            <span>${factor.label}</span>
                            <span class="risk-factor-value">${factor.value} ${getFactorUnit(key)}</span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar" 
                                 role="progressbar" 
                                 style="width: ${riskPercent}%; background-color: ${riskColor}"
                                 aria-valuenow="${riskPercent}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                        <small class="text-muted">Contribución al riesgo: ${riskPercent}%</small>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        riskFactorsDiv.innerHTML = html;
    }
    
    function displayRecommendations(mortalityProb, severityLevel) {
        let recommendation = '';
        let alertClass = '';
        
        if (mortalityProb < 0.3) {
            recommendation = 'Paciente de bajo riesgo. Seguimiento rutinario recomendado.';
            alertClass = 'alert-success';
        } else if (mortalityProb < 0.7) {
            recommendation = 'Paciente de riesgo moderado. Se recomienda evaluación adicional y posible intervención médica.';
            alertClass = 'alert-warning';
        } else {
            recommendation = 'Paciente de alto riesgo. Requiere atención inmediata y posible hospitalización.';
            alertClass = 'alert-danger';
        }
        
        // Añadir recomendaciones específicas por severidad
        if (severityLevel >= 4) {
            recommendation += ' Considerar monitoreo continuo y tratamiento intensivo.';
        } else if (severityLevel >= 2) {
            recommendation += ' Se sugiere evaluación por especialista.';
        }
        
        resultsDiv.insertAdjacentHTML('beforeend', `
            <div class="alert ${alertClass} mt-4 animate-fade-in" style="animation-delay: 0.4s">
                <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Recomendación Clínica</h5>
                <hr>
                <p class="mb-0">${recommendation}</p>
            </div>
        `);
    }
    
    function showError(message) {
        resultsDiv.innerHTML = `
            <div class="alert alert-danger animate-fade-in">
                <i class="bi bi-exclamation-octagon-fill me-2"></i>
                ${message}
            </div>
        `;
    }
    
    // Funciones auxiliares
    function getRiskColor(risk) {
        if (risk < 0.3) return '#28a745';  // Verde
        if (risk < 0.7) return '#fd7e14';  // Naranja
        return '#dc3545';                  // Rojo
    }
    
    function getSeverityColor(level) {
        const colors = {
            1: '#4CAF50',  // Verde
            2: '#8BC34A',  // Verde claro
            3: '#FFC107',  // Amarillo
            4: '#FF9800',  // Naranjo
            5: '#F44336'   // Rojo
        };
        return colors[level] || '#9E9E9E'; // Gris por defecto
    }
    
    function getFactorUnit(factor) {
        const units = {
            age: 'años',
            blood_pressure: 'mmHg',
            heart_rate: 'lpm',
            oxygen_level: '%',
            chronic_conditions: ''
        };
        return units[factor] || '';
    }
});

// Espera a que todo el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    // Configuración inicial
    const requiredElements = {
        clearFormBtn: document.getElementById('clearFormBtn'),
        predictionForm: document.getElementById('predictionForm'),
        resultsDiv: document.getElementById('results'),
    };
    
    // Verifica que todos los elementos existan
    if(Object.values(requiredElements).every(el => el !== null)) {
        initializeApp(requiredElements);
    } else {
        console.error('Faltan elementos requeridos en el DOM:', 
            Object.entries(requiredElements)
                .filter(([_, el]) => el === null)
                .map(([name, _]) => name)
        );
    }
});

function initializeApp(elements) {
    // Configurar el botón de limpiar
    elements.clearFormBtn.addEventListener('click', function() {
        if(confirm('¿Borrar todos los datos del formulario?')) {
            resetApplication(elements);
            showToast('Formulario limpiado correctamente', 'success');
        }
    });
    
    // Resto de la inicialización de tu aplicación...
}

function resetApplication({predictionForm, resultsDiv, generatePdf}) {
    // Resetear formulario
    predictionForm.reset();
    predictionForm.classList.remove('was-validated');
    
    // Resetear resultados
    resultsDiv.innerHTML = `
        <div class="alert alert-info">
            <i class="bi bi-info-circle-fill me-2"></i>
            Complete el formulario para obtener la evaluación
        </div>
    `;
}

function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type}`;
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '1100';
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

document.getElementById('saveDiagnosisDB').addEventListener('click', async function() {
    // Validar formulario
    if (!document.getElementById('first_name').value || 
        !document.getElementById('last_name').value || 
        !document.getElementById('age').value) {
        alert('Complete los datos básicos del paciente antes de guardar');
        return;
    }

    // Obtener resultados si existen
    const resultsDiv = document.getElementById('results');
    let riesgoMortalidad = '';
    let nivelSeveridad = '';
    let factoresRiesgo = '';

    if (resultsDiv && !resultsDiv.textContent.includes('Complete el formulario')) {
        riesgoMortalidad = resultsDiv.querySelector('.riesgo-mortalidad')?.textContent || '';
        nivelSeveridad = resultsDiv.querySelector('.nivel-severidad')?.textContent || '';
        factoresRiesgo = document.getElementById('riskFactors').innerText || '';
    }

    // Preparar datos para enviar
    const formData = {
        nombre: document.getElementById('first_name').value,
        apellido: document.getElementById('last_name').value,
        edad: document.getElementById('age').value,
        sexo: document.querySelector('input[name="gender"]:checked')?.value || 'no especificado',
        presion_arterial: document.getElementById('blood_pressure').value || 0,
        frecuencia_cardiaca: document.getElementById('heart_rate').value || 0,
        saturacion_oxigeno: document.getElementById('oxygen_level').value || 0,
        condiciones_cronicas: document.getElementById('chronic_conditions').value || '0',
        observaciones: document.getElementById('observations').value || '',
        riesgo_mortalidad: riesgoMortalidad,
        nivel_severidad: nivelSeveridad,
        factores_riesgo: factoresRiesgo
    };

    // Mostrar loading
    const btn = this;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-arrow-repeat me-2"></i>Guardando...';
    btn.disabled = true;

    try {
        // Enviar datos al servidor
        const response = await fetch('http://localhost/guardar_diagnostico.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            alert('Diagnóstico guardado en la base de datos con ID: ' + data.id);
        } else {
            throw new Error(data.message || 'Error al guardar el diagnóstico');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar: ' + error.message);
    } finally {
        // Restaurar botón
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

