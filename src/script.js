const appState = {
    currentCoords: { lat: 48.8566, lon: 2.3522 }, // Default to Paris
    currentLocationName: "Paris",
    currentCountry: "FR",
    weatherData: null,
    airQualityData: null,
    selectedHourIndex: 0,
    favorites: JSON.parse(localStorage.getItem('atmosphere_favorites_premium')) || [],
    recents: JSON.parse(localStorage.getItem('atmosphere_recents_premium')) || [],
    mapInstance: null,
    mapMarker: null,
    bgAnimationEngine: null,
    voiceRecognizer: null,
    audioSynth: null,
    zenActive: false,
    zenTimerInterval: null,
    windOverrideVector: { x: 0, y: 0 }, // Customized wind vector
    sandboxMode: false, // New Interactive Mode Toggle
    sandboxData: {
        temp: 20,
        precip: 0,
        type: "clear",
        isDay: true
    }
};

const DOM = {
    canvas: document.getElementById('weather-background'),
    fluidBlob1: document.getElementById('ambient-fluid-1'),
    fluidBlob2: document.getElementById('ambient-fluid-2'),
    fluidBlob3: document.getElementById('ambient-fluid-3'),
    citySearch: document.getElementById('city-search'),
    clearSearch: document.getElementById('clear-search'),
    autocompleteResults: document.getElementById('autocomplete-results'),
    voiceSearchBtn: document.getElementById('voice-search'),
    addFavoriteBtn: document.getElementById('add-favorite'),
    favStar: document.getElementById('fav-star'),
    favBtnText: document.getElementById('fav-btn-text'),
    favCount: document.getElementById('fav-count'),
    favoritesList: document.getElementById('favorites-list'),
    gpsLocateBtn: document.getElementById('gps-locate'),
    currentLocation: document.getElementById('current-location'),
    countryBadge: document.getElementById('country-badge'),
    currentDate: document.getElementById('current-date'),
    dayNightBadge: document.getElementById('day-night-badge'),
    currentTemp: document.getElementById('current-temp'),
    feelsLike: document.getElementById('feels-like'),
    heroWeatherIconContainer: document.getElementById('hero-weather-icon-container'),
    weatherDescription: document.getElementById('weather-description'),
    highTemp: document.getElementById('high-temp'),
    lowTemp: document.getElementById('low-temp'),
    precipProb: document.getElementById('precip-prob'),
    hourlyScrubber: document.getElementById('hourly-scrubber'),
    selectedHourLabel: document.getElementById('selected-hour-label'),
    hourlyCardsScroll: document.getElementById('hourly-cards-scroll'),
    weeklyForecastContainer: document.getElementById('weekly-forecast-container'),
    aqiRingStroke: document.getElementById('aqi-ring-stroke'),
    aqiRingVal: document.getElementById('aqi-ring-val'),
    aqiValue: document.getElementById('aqi-value'),
    aqiBadge: document.getElementById('aqi-badge'),
    uvRingStroke: document.getElementById('uv-ring-stroke'),
    uvRingVal: document.getElementById('uv-ring-val'),
    uvValue: document.getElementById('uv-value'),
    uvBadge: document.getElementById('uv-badge'),
    humidityRingStroke: document.getElementById('humidity-ring-stroke'),
    humidityRingVal: document.getElementById('humidity-ring-val'),
    humidityValue: document.getElementById('humidity-value'),
    dewPoint: document.getElementById('dew-point'),
    windSpeed: document.getElementById('wind-speed'),
    windDirectionDegrees: document.getElementById('wind-direction-degrees'),
    windGusts: document.getElementById('wind-gusts'),
    sunriseTime: document.getElementById('sunrise-time'),
    sunsetTime: document.getElementById('sunset-time'),
    mapCoords: document.getElementById('map-coords'),
    graphFill: document.getElementById('graph-fill'),
    graphLine: document.getElementById('graph-line'),
    graphAnchors: document.getElementById('graph-anchors')
};

class WeatherPhysicsEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.cursorParticles = []; // Dynamic particle trails
        this.splashes = [];
        this.ripples = [];
        this.windStreaks = [];
        this.panelRects = [];
        this.weatherType = 'clear'; 
        this.isDay = true;
        this.animationFrameId = null;
        this.lightningTicks = 0;
        this.lightningBolt = null;
        
        // Track interactive pointer coordinate physics
        this.mouse = { x: null, y: null, vx: 0, vy: 0, lastX: null, lastY: null };
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('scroll', () => this.updatePanelRects(), { passive: true });
        
        window.addEventListener('mousemove', (e) => {
            if (this.mouse.lastX !== null) {
                this.mouse.vx = e.clientX - this.mouse.lastX;
                this.mouse.vy = e.clientY - this.mouse.lastY;
            }
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.mouse.lastX = e.clientX;
            this.mouse.lastY = e.clientY;

            // Generate particle dust behind moving cursor
            if (Math.random() > 0.45) {
                this.generateCursorTrail(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
            this.mouse.vx = 0;
            this.mouse.vy = 0;
        });

        // Spawn shockwave ring on background click
        window.addEventListener('click', (e) => {
            if (e.target.closest('button, input, select, a, .leaflet-container')) return;
            this.createClickShockwave(e.clientX, e.clientY);
            triggerClickArpeggio(); 
        });

        this.animate();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.updatePanelRects();
        this.generateParticles();
    }

    updatePanelRects() {
        const panels = document.querySelectorAll('.glass-panel');
        this.panelRects = Array.from(panels).map(panel => {
            const rect = panel.getBoundingClientRect();
            return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom
            };
        }).filter(r => r.right > 0 && r.bottom > 0);
    }

    setWeather(type, isDay = true) {
        if (this.weatherType === type && this.isDay === isDay) return;
        this.weatherType = type;
        this.isDay = isDay;
        this.generateParticles();
        this.updateThemeOverlays();
    }

    updateThemeOverlays() {
        let color1 = 'rgba(56, 189, 248, 0.4)';  
        let color2 = 'rgba(99, 102, 241, 0.3)';  
        let color3 = 'rgba(236, 72, 153, 0.2)';  

        if (this.weatherType === 'clear' && this.isDay) {
            color1 = 'rgba(251, 191, 36, 0.45)'; 
            color2 = 'rgba(249, 115, 22, 0.35)'; 
            color3 = 'rgba(14, 165, 233, 0.15)'; 
        } else if (this.weatherType === 'stormy') {
            color1 = 'rgba(124, 58, 237, 0.45)'; 
            color2 = 'rgba(14, 165, 233, 0.2)';  
            color3 = 'rgba(244, 63, 94, 0.25)';  
        } else if (this.weatherType === 'snowy') {
            color1 = 'rgba(255, 255, 255, 0.35)'; 
            color2 = 'rgba(56, 189, 248, 0.3)';  
            color3 = 'rgba(148, 163, 184, 0.15)'; 
        } else if (this.weatherType === 'rainy') {
            color1 = 'rgba(2, 132, 199, 0.4)';   
            color2 = 'rgba(56, 189, 248, 0.25)';  
            color3 = 'rgba(30, 41, 59, 0.4)';     
        } else if (this.weatherType === 'cloudy' || this.weatherType === 'foggy') {
            color1 = 'rgba(100, 116, 139, 0.35)'; 
            color2 = 'rgba(71, 85, 105, 0.25)';  
            color3 = 'rgba(15, 23, 42, 0.4)';     
        }

        DOM.fluidBlob1.style.background = color1;
        DOM.fluidBlob2.style.background = color2;
        DOM.fluidBlob3.style.background = color3;
    }

    createClickShockwave(x, y) {
        this.ripples.push({
            x,
            y,
            r: 5,
            maxR: Math.random() * 120 + 100,
            opacity: 0.8,
            speed: 4
        });
    }

    generateCursorTrail(x, y) {
        let color = "#38bdf8";
        if (this.weatherType === 'clear' && this.isDay) color = "#fbbf24";
        if (this.weatherType === 'snowy') color = "#ffffff";
        if (this.weatherType === 'stormy') color = "#a78bfa";

        this.cursorParticles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3 - 1,
            r: Math.random() * 3 + 1,
            alpha: 1.0,
            color: color,
            life: 40
        });
    }

    generateParticles() {
        this.particles = [];
        this.windStreaks = [];
        const w = this.canvas.width;
        const h = this.canvas.height;
        const areaFactor = (w * h) / 10000;

        const streakCount = Math.floor(areaFactor * 0.12) + 3;
        for (let i = 0; i < streakCount; i++) {
            this.windStreaks.push({
                x: Math.random() * w,
                y: Math.random() * h,
                len: Math.random() * 120 + 80,
                speed: Math.random() * 1.5 + 0.5,
                width: Math.random() * 1.5 + 0.5,
                opacity: Math.random() * 0.08 + 0.02
            });
        }

        if (this.weatherType === 'rainy' || this.weatherType === 'stormy') {
            const count = Math.floor(areaFactor * 2.2);
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h - h,
                    len: Math.random() * 25 + 14,
                    speedY: Math.random() * 11 + 16,
                    speedX: -2.5 - Math.random() * 2, 
                    opacity: Math.random() * 0.45 + 0.15,
                    reactiveX: 0,
                    reactiveY: 0
                });
            }
        } else if (this.weatherType === 'snowy') {
            const count = Math.floor(areaFactor * 1.4);
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h - h,
                    r: Math.random() * 2.8 + 0.8,
                    speedY: Math.random() * 1.1 + 0.6,
                    opacity: Math.random() * 0.65 + 0.2,
                    swingAngle: Math.random() * Math.PI * 2,
                    swingSpeed: Math.random() * 0.025 + 0.01,
                    swingRadius: Math.random() * 1.8 + 0.5,
                    reactiveX: 0,
                    reactiveY: 0
                });
            }
        } else if (this.weatherType === 'cloudy' || this.weatherType === 'foggy') {
            const count = this.weatherType === 'foggy' ? 14 : 7;
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * w - 150,
                    y: Math.random() * h,
                    r: Math.random() * 190 + 130,
                    speedX: Math.random() * 0.15 + 0.05,
                    opacity: Math.random() * 0.06 + 0.02
                });
            }
        } else if (this.weatherType === 'clear') {
            const count = this.isDay ? 18 : 85; 
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: this.isDay ? Math.random() * 3.5 + 1 : Math.random() * 1.3 + 0.5,
                    speedY: this.isDay ? -Math.random() * 0.18 - 0.05 : 0,
                    opacity: Math.random() * 0.65 + 0.2,
                    sparkleSpeed: Math.random() * 0.035 + 0.005,
                    sparklePhase: Math.random() * Math.PI * 2
                });
            }
        }
    }

    drawLightning(ctx, startX, startY, segments, width) {
        if (segments <= 0) return;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        let currentX = startX;
        let currentY = startY;

        const path = [{ x: currentX, y: currentY }];

        for (let i = 0; i < segments; i++) {
            const nextY = currentY + (this.canvas.height / segments) * (Math.random() * 0.45 + 0.75);
            const nextX = currentX + (Math.random() - 0.5) * 90;
            path.push({ x: nextX, y: nextY });
            currentX = nextX;
            currentY = nextY;
        }

        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = width;
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; 
    }

    animate() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        ctx.clearRect(0, 0, w, h);

        let skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        if (this.isDay) {
            if (this.weatherType === 'clear') {
                skyGrad.addColorStop(0, '#0a1d37');
                skyGrad.addColorStop(1, '#040710');
            } else if (this.weatherType === 'cloudy' || this.weatherType === 'foggy') {
                skyGrad.addColorStop(0, '#151e2e');
                skyGrad.addColorStop(1, '#05080f');
            } else {
                skyGrad.addColorStop(0, '#0e1420');
                skyGrad.addColorStop(1, '#02050c');
            }
        } else {
            skyGrad.addColorStop(0, '#02040a');
            skyGrad.addColorStop(1, '#010204');
        }
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Render Aurora Ribbons (Clear Cold Nights)
        if (!this.isDay && this.weatherType === 'clear') {
            const time = Date.now() * 0.0005;
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            
            for (let r = 0; r < 2; r++) {
                const gradient = ctx.createLinearGradient(0, 0, w, 0);
                gradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
                gradient.addColorStop(0.3, `rgba(16, 185, 129, ${0.08 - r * 0.03})`);
                gradient.addColorStop(0.6, `rgba(99, 102, 241, ${0.06 - r * 0.02})`);
                gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
                
                ctx.beginPath();
                ctx.moveTo(0, h * 0.2 + r * 50);
                for (let x = 0; x <= w; x += 40) {
                    const offset = Math.sin(x * 0.002 + time + r) * 40 + Math.cos(x * 0.001 - time * 0.8) * 20;
                    ctx.lineTo(x, h * 0.35 + offset + r * 30);
                }
                ctx.lineTo(w, h);
                ctx.lineTo(0, h);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
            }
            ctx.restore();
        }

        // Render Sun Flares
        if (this.isDay && this.weatherType === 'clear') {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            
            const sunX = w * 0.75 + (this.mouse.x ? (this.mouse.x - w / 2) * 0.03 : 0);
            const sunY = h * 0.25 + (this.mouse.y ? (this.mouse.y - h / 2) * 0.03 : 0);
            
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, Math.min(w, h) * 0.4);
            sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.25)');
            sunGlow.addColorStop(0.1, 'rgba(253, 186, 116, 0.12)');
            sunGlow.addColorStop(0.5, 'rgba(14, 165, 233, 0.03)');
            sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, Math.min(w, h) * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Run visual wind streamline loops
        ctx.save();
        for (let streak of this.windStreaks) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(56, 189, 248, ${streak.opacity})`;
            ctx.lineWidth = streak.width;
            
            const finalSpeedX = streak.speed + (appState.windOverrideVector.x * 4.0);
            const finalSpeedY = (appState.windOverrideVector.y * 1.5);
            
            ctx.moveTo(streak.x, streak.y);
            ctx.lineTo(streak.x + streak.len, streak.y + (appState.windOverrideVector.y * 30));
            ctx.stroke();

            streak.x += finalSpeedX;
            streak.y += finalSpeedY;

            if (streak.x > w) {
                streak.x = -streak.len;
                streak.y = Math.random() * h;
            }
        }
        ctx.restore();

        // Shockwave calculations
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            let r = this.ripples[i];
            r.r += r.speed;
            r.opacity -= 0.015;
            
            if (r.opacity <= 0) {
                this.ripples.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.strokeStyle = `rgba(56, 189, 248, ${r.opacity})`;
            ctx.lineWidth = 1.5;
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Dynamic mouse particle trail loop
        for (let i = this.cursorParticles.length - 1; i >= 0; i--) {
            let cp = this.cursorParticles[i];
            cp.x += cp.vx;
            cp.y += cp.vy;
            cp.alpha -= 0.025;
            cp.life--;

            if (cp.life <= 0 || cp.alpha <= 0) {
                this.cursorParticles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.fillStyle = cp.color;
            ctx.globalAlpha = cp.alpha;
            ctx.arc(cp.x, cp.y, cp.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // Splatter particles on screen
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            let s = this.splashes[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.25; 
            s.life--;

            ctx.beginPath();
            ctx.fillStyle = `rgba(56, 189, 248, ${s.opacity * (s.life / s.maxLife)})`;
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();

            if (s.life <= 0) {
                this.splashes.splice(i, 1);
            }
        }

        // Storm lightning ticks
        if (this.weatherType === 'stormy') {
            if (this.lightningTicks <= 0 && Math.random() > 0.994) {
                this.lightningTicks = Math.floor(Math.random() * 14) + 6;
                this.lightningBolt = {
                    x: Math.random() * w,
                    y: 0,
                    segments: Math.floor(Math.random() * 5) + 7,
                    width: Math.random() * 3.5 + 1.5
                };
                if (appState.audioSynth && appState.audioSynth.playing) {
                    appState.audioSynth.triggerThunderCrack();
                }
            }

            if (this.lightningTicks > 0) {
                this.lightningTicks--;
                if (this.lightningTicks % 3 === 0) {
                    ctx.fillStyle = 'rgba(224, 242, 254, 0.18)';
                    ctx.fillRect(0, 0, w, h);
                    if (this.lightningBolt) {
                        this.drawLightning(ctx, this.lightningBolt.x, this.lightningBolt.y, this.lightningBolt.segments, this.lightningBolt.width);
                    }
                }
            }
        }

        // Particle Loop with Dynamic Card Top Edge Collisions
        if (this.weatherType === 'rainy' || this.weatherType === 'stormy') {
            for (let p of this.particles) {
                for (let rip of this.ripples) {
                    const dx = p.x - rip.x;
                    const dy = p.y - rip.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < rip.r + 20 && dist > rip.r - 20) {
                        const angle = Math.atan2(dy, dx);
                        p.x += Math.cos(angle) * rip.speed * 2.0;
                        p.y += Math.sin(angle) * rip.speed * 1.5;
                    }
                }

                if (this.mouse.x !== null) {
                    const dx = p.x - this.mouse.x;
                    const dy = p.y - this.mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        const force = (120 - dist) / 120;
                        p.reactiveX += (dx / dist) * force * 4;
                        p.reactiveY += (dy / dist) * force * 2;
                    }
                }

                p.reactiveX *= 0.92;
                p.reactiveY *= 0.92;

                const finalSpeedX = (p.speedX + appState.windOverrideVector.x * 4.0);
                const finalSpeedY = (p.speedY + Math.abs(appState.windOverrideVector.y * 1.5));

                const currentX = p.x + p.reactiveX;
                const currentY = p.y + p.reactiveY;

                let collided = false;
                for (let rect of this.panelRects) {
                    if (currentX >= rect.left && currentX <= rect.right &&
                        currentY >= rect.top && currentY <= rect.top + p.speedY) {
                        this.triggerSplashes(currentX, rect.top, 3);
                        collided = true;
                        break;
                    }
                }

                if (collided || currentY > h - 12) {
                    if (!collided) {
                        this.triggerSplashes(currentX, h - 12, 4);
                    }
                    p.y = -p.len;
                    p.x = Math.random() * w;
                    p.reactiveX = 0;
                    p.reactiveY = 0;
                } else {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(56, 189, 248, ${p.opacity})`;
                    ctx.lineWidth = 1.3;
                    ctx.moveTo(currentX, currentY);
                    ctx.lineTo(currentX + finalSpeedX * 0.4, currentY + p.len);
                    ctx.stroke();

                    p.y += finalSpeedY;
                    p.x += finalSpeedX;
                }
            }
        } else if (this.weatherType === 'snowy') {
            for (let p of this.particles) {
                for (let rip of this.ripples) {
                    const dx = p.x - rip.x;
                    const dy = p.y - rip.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < rip.r + 30 && dist > rip.r - 30) {
                        const angle = Math.atan2(dy, dx);
                        p.x += Math.cos(angle) * rip.speed * 1.5;
                    }
                }

                if (this.mouse.x !== null) {
                    const dx = p.x - this.mouse.x;
                    const dy = p.y - this.mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 140) {
                        const force = (140 - dist) / 140;
                        p.reactiveX += (dx / dist) * force * 3;
                        p.reactiveY += (dy / dist) * force * 2;
                    }
                }

                p.reactiveX *= 0.95;
                p.reactiveY *= 0.95;

                const driftX = Math.sin(p.swingAngle) * p.swingRadius + (appState.windOverrideVector.x * 2.0);
                const finalSnowSpeedY = p.speedY + Math.abs(appState.windOverrideVector.y * 0.5);
                
                const currentX = p.x + driftX + p.reactiveX;
                const currentY = p.y + p.reactiveY;

                let collided = false;
                for (let rect of this.panelRects) {
                    if (currentX >= rect.left && currentX <= rect.right &&
                        currentY >= rect.top && currentY <= rect.top + p.speedY) {
                        this.triggerSplashes(currentX, rect.top, 1, 0.4);
                        collided = true;
                        break;
                    }
                }

                if (collided || currentY > h) {
                    p.y = -5;
                    p.x = Math.random() * w;
                    p.reactiveX = 0;
                    p.reactiveY = 0;
                } else {
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
                    ctx.arc(currentX, currentY, p.r, 0, Math.PI * 2);
                    ctx.fill();

                    p.y += finalSnowSpeedY;
                    p.x += appState.windOverrideVector.x * 0.8;
                    p.swingAngle += p.swingSpeed;
                }
            }
        } else if (this.weatherType === 'cloudy' || this.weatherType === 'foggy') {
            for (let p of this.particles) {
                ctx.beginPath();
                let cloudGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
                cloudGrad.addColorStop(0, `rgba(148, 163, 184, ${p.opacity})`);
                cloudGrad.addColorStop(0.8, `rgba(148, 163, 184, ${p.opacity * 0.25})`);
                cloudGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
                ctx.fillStyle = cloudGrad;
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();

                p.x += p.speedX + (appState.windOverrideVector.x * 1.2);
                p.y += appState.windOverrideVector.y * 0.4;

                if (p.x - p.r > w) {
                    p.x = -p.r;
                    p.y = Math.random() * h;
                }
            }
        } else if (this.weatherType === 'clear') {
            for (let p of this.particles) {
                const alpha = p.opacity * (0.35 + 0.65 * Math.abs(Math.sin(Date.now() * p.sparkleSpeed + p.sparklePhase)));
                ctx.beginPath();
                
                if (this.isDay) {
                    let sparkleGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5.5);
                    sparkleGrad.addColorStop(0, `rgba(251, 191, 36, ${alpha})`);
                    sparkleGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
                    ctx.fillStyle = sparkleGrad;
                    ctx.arc(p.x, p.y, p.r * 5.5, 0, Math.PI * 2);
                    ctx.fill();

                    p.y += p.speedY + (appState.windOverrideVector.y * 0.2);
                    p.x += appState.windOverrideVector.x * 0.2;

                    if (p.y < -p.r * 5.5) {
                        p.y = h + p.r * 5.5;
                        p.x = Math.random() * w;
                    }
                } else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.arc(p.x + (appState.windOverrideVector.x * 0.1), p.y + (appState.windOverrideVector.y * 0.1), p.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    triggerSplashes(x, y, count = 3, gravityScale = 1.0) {
        for (let i = 0; i < count; i++) {
            const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.8;
            const force = Math.random() * 3 + 1.5;
            this.splashes.push({
                x,
                y,
                vx: Math.cos(angle) * force,
                vy: Math.sin(angle) * force * gravityScale,
                r: Math.random() * 1.5 + 0.5,
                opacity: Math.random() * 0.6 + 0.4,
                life: Math.floor(Math.random() * 15) + 15,
                maxLife: 30
            });
        }
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }
}

function setupPremiumTiltInteractivity() {
    const panels = document.querySelectorAll('.glass-panel');
    
    panels.forEach(panel => {
        panel.addEventListener('mousemove', (e) => {
            const rect = panel.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const percentX = x / rect.width;
            const percentY = y / rect.height;
            
            const tiltX = (0.5 - percentY) * 12; 
            const tiltY = (percentX - 0.5) * 12;
            
            panel.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.015, 1.015, 1.015)`;
            
            panel.style.setProperty('--mouse-x', `${percentX * 100}%`);
            panel.style.setProperty('--mouse-y', `${percentY * 100}%`);
        });
        
        panel.addEventListener('mouseleave', () => {
            panel.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            panel.style.setProperty('--mouse-x', '50%');
            panel.style.setProperty('--mouse-y', '50%');
        });
    });
}

window.triggerCardWobble = function(el) {
    el.classList.add('spring-click-animation');
    el.addEventListener('animationend', () => {
        el.classList.remove('spring-click-animation');
    }, { once: true });
    
    triggerCardTickSound(); 
};

const SVGVectors = {
    clear: (isDay) => isDay ? `
        <svg viewBox="0 0 64 64" class="w-full h-full">
            <circle cx="32" cy="32" r="12" fill="#fbbf24" />
            <g class="sunbeam-spin" stroke="#fbbf24" stroke-width="3" stroke-linecap="round">
                <line x1="32" y1="12" x2="32" y2="4" />
                <line x1="32" y1="52" x2="32" y2="60" />
                <line x1="12" y1="32" x2="4" y2="32" />
                <line x1="52" y1="32" x2="60" y2="32" />
                <line x1="18" y1="18" x2="12" y2="12" />
                <line x1="46" y1="46" x2="52" y2="52" />
                <line x1="18" y1="46" x2="12" y2="52" />
                <line x1="46" y1="18" x2="52" y2="12" />
            </g>
        </svg>
    ` : `
        <svg viewBox="0 0 64 64" class="w-full h-full animate-bounce" style="animation-duration: 6s;">
            <path d="M42 36c0-7.7-6.3-14-14-14-1.8 0-3.5.3-5.1 1 3.5 1.5 6 5 6 9.1 0 5.5-4.5 10-10 10-1 0-2-.2-3-.5 3.3 5 8.8 8.4 15.1 8.4 10 0 11-14 11-14z" fill="#38bdf8" />
            <circle cx="16" cy="16" r="0.8" fill="#ffffff" class="animate-pulse" />
            <circle cx="48" cy="18" r="0.5" fill="#ffffff" style="animation-delay: 0.5s" class="animate-pulse" />
        </svg>
    `,
    cloudy: (isDay) => `
        <svg viewBox="0 0 64 64" class="w-full h-full">
            ${isDay ? '<circle cx="40" cy="24" r="8" fill="#fbbf24" />' : ''}
            <path class="cloud-drift-1" d="M44 42H24c-4.4 0-8-3.6-8-8s3.6-8 8-8h1.2c1.3-4.5 5.4-7.8 10.3-7.8 4.7 0 8.7 3.1 10.1 7.4.7-.3 1.5-.4 2.3-.4 3.9 0 7.1 3.2 7.1 7.1s-3.2 7.1-7.1 7.1z" fill="#94a3b8" />
            <path class="cloud-drift-2" d="M38 46H20c-3.3 0-6-2.7-6-6s2.7-6 6-6h.9c1-3.4 4-5.8 7.7-5.8 3.5 0 6.5 2.3 7.6 5.5.5-.2 1.1-.3 1.7-.3 2.9 0 5.3 2.4 5.3 5.3s-2.4 5.3-5.3 5.3z" fill="#cbd5e1" fill-opacity="0.95" />
        </svg>
    `,
    rainy: () => `
        <svg viewBox="0 0 64 64" class="w-full h-full">
            <path d="M40 34H24c-3.3 0-6-2.7-6-6s2.7-6 6-6h.9c1-3.4 4-5.8 7.7-5.8 3.5 0 6.5 2.3 7.6 5.5.5-.2 1.1-.3 1.7-.3 2.9 0 5.3 2.4 5.3 5.3s-2.4 5.3-5.3 5.3z" fill="#475569" />
            <g stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
                <line x1="22" y1="40" x2="19" y2="48" class="rain-drop-fall" />
                <line x1="28" y1="42" x2="25" y2="50" class="rain-drop-fall" style="animation-delay: 0.3s" />
                <line x1="34" y1="40" x2="31" y2="48" class="rain-drop-fall" style="animation-delay: 0.6s" />
                <line x1="40" y1="42" x2="37" y2="50" class="rain-drop-fall" style="animation-delay: 0.1s" />
            </g>
        </svg>
    `,
    stormy: () => `
        <svg viewBox="0 0 64 64" class="w-full h-full">
            <path d="M40 34H24c-3.3 0-6-2.7-6-6s2.7-6 6-6h.9c1-3.4 4-5.8 7.7-5.8 3.5 0 6.5 2.3 7.6 5.5.5-.2 1.1-.3 1.7-.3 2.9 0 5.3 2.4 5.3 5.3s-2.4 5.3-5.3 5.3z" fill="#1e293b" />
            <path d="M28 38l4 6h-6l5 8-1-6h5l-7-8z" fill="#fbbf24" class="animate-pulse" />
        </svg>
    `,
    snowy: () => `
        <svg viewBox="0 0 64 64" class="w-full h-full">
            <path d="M40 34H24c-3.3 0-6-2.7-6-6s2.7-6 6-6h.9c1-3.4 4-5.8 7.7-5.8 3.5 0 6.5 2.3 7.6 5.5.5-.2 1.1-.3 1.7-.3 2.9 0 5.3 2.4 5.3 5.3s-2.4 5.3-5.3 5.3z" fill="#64748b" />
            <g stroke="#ffffff" stroke-width="2" stroke-linecap="round">
                <circle cx="23" cy="42" r="1.5" class="animate-ping" />
                <circle cx="31" cy="46" r="1.5" class="animate-ping" style="animation-delay: 0.4s" />
                <circle cx="39" cy="42" r="1.5" class="animate-ping" style="animation-delay: 0.8s" />
            </g>
        </svg>
    `,
    foggy: () => `
        <svg viewBox="0 0 64 64" class="w-full h-full">
            <path d="M40 30H24c-3.3 0-6-2.7-6-6 0-3 2.2-5.5 5.1-5.9h.9C25 14.7 28 12.3 31.7 12.3c3.5 0 6.5 2.3 7.6 5.5.5-.2 1.1-.3 1.7-.3 2.9 0 5.3 2.4 5.3 5.3s-2.4 5.3-5.3 5.3z" fill="#475569" fill-opacity="0.8" />
            <line x1="16" y1="36" x2="48" y2="36" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" class="cloud-drift-1" />
            <line x1="20" y1="42" x2="44" y2="42" stroke="#cbd5e1" stroke-width="3.5" stroke-linecap="round" class="cloud-drift-2" />
            <line x1="14" y1="48" x2="50" y2="48" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" class="cloud-drift-1" />
        </svg>
    `
};

const WeatherConditionMap = {
    0: { desc: "Clear Sky", icon: "clear" },
    1: { desc: "Mainly Clear", icon: "clear" },
    2: { desc: "Partly Cloudy", icon: "cloudy" },
    3: { desc: "Overcast Clouds", icon: "cloudy" },
    45: { desc: "Dense Fog", icon: "foggy" },
    48: { desc: "Rime Fog", icon: "foggy" },
    51: { desc: "Light Drizzle", icon: "rainy" },
    53: { desc: "Moderate Drizzle", icon: "rainy" },
    55: { desc: "Heavy Drizzle", icon: "rainy" },
    61: { desc: "Slight Rain", icon: "rainy" },
    63: { desc: "Moderate Rain", icon: "rainy" },
    65: { desc: "Heavy Rainfall", icon: "rainy" },
    71: { desc: "Light Snowfall", icon: "snowy" },
    73: { desc: "Moderate Snow", icon: "snowy" },
    75: { desc: "Heavy Snowfall", icon: "snowy" },
    77: { desc: "Snow Grains", icon: "snowy" },
    80: { desc: "Rain Showers", icon: "rainy" },
    81: { desc: "Heavy Rain Showers", icon: "rainy" },
    82: { desc: "Torrential Showers", icon: "rainy" },
    85: { desc: "Slight Snow Showers", icon: "snowy" },
    86: { desc: "Heavy Snow Showers", icon: "snowy" },
    95: { desc: "Thunderstorm", icon: "stormy" },
    96: { desc: "Storm with Hail", icon: "stormy" },
    99: { desc: "Severe Thunderstorm", icon: "stormy" }
};

function getWeatherMeta(code) {
    return WeatherConditionMap[code] || { desc: "Local Atmosphere", icon: "cloudy" };
}

class WeatherSoundGenerator {
    constructor() {
        this.audioCtx = null;
        this.playing = false;
        this.rainNoise = null;
        this.rainFilter = null;
        this.rainGain = null;
        this.windNoise = null;
        this.windFilter = null;
        this.windGain = null;
        this.windLFO = null;
        this.starOsc = null;
        this.starGain = null;
        this.starInterval = null;
    }

    initContext() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    createNoiseBuffer() {
        const bufferSize = this.audioCtx.sampleRate * 2;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    startSynth(weatherType, isDay) {
        if (!this.audioCtx) this.initContext();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.playing = true;
        
        this.setupWindSynth();
        this.setupRainSynth();
        this.setupStarSynth(weatherType, isDay);

        this.adjustSoundscapeLevels(weatherType, isDay);
    }

    setupWindSynth() {
        const windBuffer = this.createNoiseBuffer();
        this.windNoise = this.audioCtx.createBufferSource();
        this.windNoise.buffer = windBuffer;
        this.windNoise.loop = true;

        this.windFilter = this.audioCtx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 400;
        this.windFilter.Q.value = 2.0;

        this.windGain = this.audioCtx.createGain();
        this.windGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

        this.windLFO = this.audioCtx.createOscillator();
        this.windLFO.frequency.value = 0.08; 
        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = 350; 

        this.windLFO.connect(lfoGain);
        lfoGain.connect(this.windFilter.frequency);
        
        this.windNoise.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.audioCtx.destination);

        this.windNoise.start(0);
        this.windLFO.start(0);
    }

    setupRainSynth() {
        const rainBuffer = this.createNoiseBuffer();
        this.rainNoise = this.audioCtx.createBufferSource();
        this.rainNoise.buffer = rainBuffer;
        this.rainNoise.loop = true;

        this.rainFilter = this.audioCtx.createBiquadFilter();
        this.rainFilter.type = 'highpass';
        this.rainFilter.frequency.value = 1800;

        this.rainGain = this.audioCtx.createGain();
        this.rainGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);

        this.rainNoise.connect(this.rainFilter);
        this.rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.audioCtx.destination);

        this.rainNoise.start(0);
    }

    setupStarSynth(weatherType, isDay) {
        if (weatherType === 'clear' && !isDay) {
            this.starGain = this.audioCtx.createGain();
            this.starGain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            this.starGain.connect(this.audioCtx.destination);

            this.starInterval = setInterval(() => {
                if (!this.playing) return;
                const osc = this.audioCtx.createOscillator();
                const oscGain = this.audioCtx.createGain();
                
                osc.type = 'triangle';
                const notes = [523.25, 587.33, 659.25, 783.99, 880.00]; 
                const randomPitch = notes[Math.floor(Math.random() * notes.length)];
                osc.frequency.setValueAtTime(randomPitch, this.audioCtx.currentTime);

                oscGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
                oscGain.gain.linearRampToValueAtTime(0.08, this.audioCtx.currentTime + 0.1);
                oscGain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 2.0);

                osc.connect(oscGain);
                oscGain.connect(this.starGain);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 2.0);
            }, 2400);
        }
    }

    adjustSoundscapeLevels(type, isDay) {
        if (!this.playing) return;
        const now = this.audioCtx.currentTime;

        if (type === 'rainy') {
            this.windGain.gain.linearRampToValueAtTime(0.07, now + 2);
            this.rainGain.gain.linearRampToValueAtTime(0.12, now + 2);
        } else if (type === 'stormy') {
            this.windGain.gain.linearRampToValueAtTime(0.15, now + 2);
            this.rainGain.gain.linearRampToValueAtTime(0.16, now + 2);
        } else if (type === 'snowy') {
            this.windGain.gain.linearRampToValueAtTime(0.06, now + 2);
            this.rainGain.gain.linearRampToValueAtTime(0.0, now + 2);
        } else if (type === 'cloudy' || type === 'foggy') {
            this.windGain.gain.linearRampToValueAtTime(0.04, now + 2);
            this.rainGain.gain.linearRampToValueAtTime(0.0, now + 2);
        } else {
            this.windGain.gain.linearRampToValueAtTime(0.015, now + 2);
            this.rainGain.gain.linearRampToValueAtTime(0.0, now + 2);
        }
    }

    triggerThunderCrack() {
        if (!this.playing || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(45, now);
        osc.frequency.linearRampToValueAtTime(20, now + 2.5);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, now);

        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.1); 
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5); 

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 2.5);
    }

    stopSynth() {
        this.playing = false;
        const fadeTime = 0.5;
        const now = this.audioCtx ? this.audioCtx.currentTime : 0;

        if (this.windGain) this.windGain.gain.linearRampToValueAtTime(0.0, now + fadeTime);
        if (this.rainGain) this.rainGain.gain.linearRampToValueAtTime(0.0, now + fadeTime);
        
        setTimeout(() => {
            if (this.windNoise) try { this.windNoise.stop(); } catch(e) {}
            if (this.windLFO) try { this.windLFO.stop(); } catch(e) {}
            if (this.rainNoise) try { this.rainNoise.stop(); } catch(e) {}
            if (this.starInterval) clearInterval(this.starInterval);
        }, fadeTime * 1000);
    }
}

let uiAudioCtx = null;
function initUiAudio() {
    if (!uiAudioCtx) {
        uiAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playUiTone(freq, duration, type = "sine", gainVal = 0.06) {
    initUiAudio();
    if (!uiAudioCtx) return;
    if (uiAudioCtx.state === 'suspended') uiAudioCtx.resume();

    const now = uiAudioCtx.currentTime;
    const osc = uiAudioCtx.createOscillator();
    const gain = uiAudioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(uiAudioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
}

window.triggerCardTickSound = () => {
    playUiTone(620, 0.1, "triangle", 0.05);
};

window.triggerSliderTick = () => {
    playUiTone(440, 0.05, "sine", 0.03);
};

window.triggerClickArpeggio = () => {
    playUiTone(523.25, 0.2, "sine", 0.04);
    setTimeout(() => playUiTone(659.25, 0.2, "sine", 0.04), 80);
    setTimeout(() => playUiTone(783.99, 0.25, "sine", 0.04), 160);
};

window.triggerInteractiveAlert = (type) => {
    if (type === "success") {
        playUiTone(880, 0.15, "sine", 0.04);
        setTimeout(() => playUiTone(1046.50, 0.25, "sine", 0.05), 100);
    } else {
        playUiTone(220, 0.2, "sawtooth", 0.03);
    }
};

document.querySelectorAll('input[type="range"]').forEach(input => {
    input.addEventListener('input', triggerSliderTick);
});

function toggleAudioSynth() {
    if (!appState.audioSynth) {
        appState.audioSynth = new WeatherSoundGenerator();
    }

    const btn = document.getElementById('audio-synth-toggle');
    const label = document.getElementById('audio-synth-status');
    const icon = document.getElementById('sound-speaker-icon');
    const wave = document.getElementById('soundwave-container');

    if (!appState.audioSynth.playing) {
        const meta = getWeatherMeta(appState.weatherData ? appState.weatherData.current.weather_code : 0);
        appState.audioSynth.startSynth(meta.icon, appState.weatherData ? (appState.weatherData.current.is_day === 1) : true);
        
        label.textContent = "Weather Soundscape Active";
        icon.className = "fa-solid fa-volume-high text-sky-400";
        btn.classList.add('border-sky-500/30');
        wave.classList.remove('hidden');
        triggerInteractiveAlert("success");
    } else {
        appState.audioSynth.stopSynth();
        
        label.textContent = "Enable Weather Soundscape";
        icon.className = "fa-solid fa-volume-xmark text-slate-400";
        btn.classList.remove('border-sky-500/30');
        wave.classList.add('hidden');
        playUiTone(280, 0.12, "sine", 0.04);
    }
}

function toggleZenMode() {
    const body = document.body;
    appState.zenActive = !appState.zenActive;

    playUiTone(appState.zenActive ? 320 : 480, 0.4, "sine", 0.05);

    if (appState.zenActive) {
        body.classList.add('zen-active');
        startZenDynamicClock();
        renderZenStats();
        renderUserFeedbackToast("Entered Immersive Zen Space.", "info");
    } else {
        body.classList.remove('zen-active');
        if (appState.zenTimerInterval) clearInterval(appState.zenTimerInterval);
    }
    setTimeout(() => {
        if (appState.bgAnimationEngine) appState.bgAnimationEngine.updatePanelRects();
    }, 800);
}

function startZenDynamicClock() {
    const clockEl = document.getElementById('zen-clock');
    const dateEl = document.getElementById('zen-date');
    
    const refresh = () => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    };

    refresh();
    appState.zenTimerInterval = setInterval(refresh, 1000);
}

function renderZenStats() {
    let curTemp = 0;
    let weatherIcon = "";
    let meta = { icon: "clear", desc: "Clear" };

    if (appState.sandboxMode) {
        curTemp = appState.sandboxData.temp;
        meta = { icon: appState.sandboxData.type, desc: appState.sandboxData.type };
        weatherIcon = SVGVectors[appState.sandboxData.type](appState.sandboxData.isDay);
    } else if (appState.weatherData) {
        const cur = appState.weatherData.current;
        meta = getWeatherMeta(cur.weather_code);
        curTemp = Math.round(cur.temperature_2m);
        weatherIcon = SVGVectors[meta.icon](cur.is_day === 1);
    }
    
    document.getElementById('zen-temp').textContent = curTemp;
    document.getElementById('zen-weather-icon-container').innerHTML = weatherIcon;
    document.getElementById('zen-location-badge').textContent = appState.sandboxMode ? "CLIMATE SIMULATOR" : `${appState.currentLocationName}, ${appState.currentCountry}`;

    const greetings = {
        clear: "Breathe in, let the clear light refresh your thoughts.",
        cloudy: "Soft shadows form above. Relax your vision.",
        rainy: "Listen to the dynamic rhythms of rain washing clean.",
        stormy: "A powerful tempest is clearing away old energy.",
        snowy: "Gentle crystals fall, blankets of tranquility.",
        foggy: "Quiet mists surround you. Turn your attention inward."
    };
    document.getElementById('zen-greeting').textContent = greetings[meta.icon] || "A beautiful moment of tranquility.";
}

window.toggleSandboxMode = function(isSandbox) {
    appState.sandboxMode = isSandbox;
    
    const btnLive = document.getElementById('btn-mode-live');
    const btnSandbox = document.getElementById('btn-mode-sandbox');
    const controls = document.getElementById('sandbox-controls');

    playUiTone(isSandbox ? 700 : 500, 0.25, "sine", 0.05);

    if (isSandbox) {
        btnLive.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition tracking-wider text-slate-400 hover:text-white";
        btnSandbox.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition tracking-wider bg-amber-500/20 text-amber-300";
        controls.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 opacity-100 pointer-events-auto transition-all duration-500";
        const sandboxSection = document.getElementById('sandbox-section');
        if (sandboxSection) sandboxSection.classList.add('sandbox-active-border');
        
        renderUserFeedbackToast("Climate Simulation Sandbox Active!", "warning");
        adjustSandboxSimulation();
    } else {
        btnLive.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition tracking-wider bg-sky-500/20 text-sky-300";
        btnSandbox.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition tracking-wider text-slate-400 hover:text-white";
        controls.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 opacity-40 pointer-events-none transition-all duration-500";
        const sandboxSection = document.getElementById('sandbox-section');
        if (sandboxSection) sandboxSection.classList.remove('sandbox-active-border');
        
        renderUserFeedbackToast("Returned to Live Met Station feed", "info");
        synchronizeMeteorologicalData();
    }
};

window.setSandboxCycle = function(isDay) {
    appState.sandboxData.isDay = isDay;
    document.getElementById('btn-sandbox-day').className = isDay ? "flex-1 py-1 px-3 rounded-xl bg-sky-500/20 text-sky-300 text-xs font-bold uppercase transition" : "flex-1 py-1 px-3 rounded-xl bg-white/5 text-slate-400 text-xs font-bold uppercase transition";
    document.getElementById('btn-sandbox-night').className = !isDay ? "flex-1 py-1 px-3 rounded-xl bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase transition" : "flex-1 py-1 px-3 rounded-xl bg-white/5 text-slate-400 text-xs font-bold uppercase transition";
    
    adjustSandboxSimulation();
};

window.adjustSandboxSimulation = function() {
    if (!appState.sandboxMode) return;

    const temp = parseInt(document.getElementById('slider-sandbox-temp').value);
    const precip = parseInt(document.getElementById('slider-sandbox-precip').value);
    const type = document.getElementById('select-sandbox-type').value;

    appState.sandboxData.temp = temp;
    appState.sandboxData.precip = precip;
    appState.sandboxData.type = type;

    document.getElementById('sandbox-temp-readout').textContent = `${temp}°C`;
    document.getElementById('sandbox-precip-readout').textContent = `${precip}%`;
    document.getElementById('sandbox-type-readout').textContent = type;
    document.getElementById('sandbox-cycle-readout').textContent = appState.sandboxData.isDay ? "DAY" : "NIGHT";

    appState.bgAnimationEngine.setWeather(type, appState.sandboxData.isDay);

    DOM.currentLocation.textContent = "CLIMATE SIMULATOR";
    DOM.countryBadge.textContent = "TEST";
    DOM.currentTemp.textContent = temp;
    DOM.feelsLike.textContent = temp;
    DOM.highTemp.textContent = temp + 5;
    DOM.lowTemp.textContent = temp - 4;
    DOM.precipProb.textContent = precip;

    DOM.heroWeatherIconContainer.innerHTML = SVGVectors[type](appState.sandboxData.isDay);
    DOM.weatherDescription.textContent = `Simulated ${type.toUpperCase()}`;

    if (appState.sandboxData.isDay) {
        DOM.dayNightBadge.innerHTML = `<i class="fa-solid fa-sun text-amber-400 animate-pulse"></i> Daytime Cycle Override`;
        DOM.dayNightBadge.className = "text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl glass-card text-amber-400 flex items-center gap-2 uppercase tracking-wider border border-amber-400/10";
    } else {
        DOM.dayNightBadge.innerHTML = `<i class="fa-solid fa-moon text-indigo-400 animate-pulse"></i> Dusk Occultation Override`;
        DOM.dayNightBadge.className = "text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl glass-card text-indigo-400 flex items-center gap-2 uppercase tracking-wider border border-indigo-400/10";
    }

    if (appState.audioSynth && appState.audioSynth.playing) {
        appState.audioSynth.adjustSoundscapeLevels(type, appState.sandboxData.isDay);
    }
};

(function setupWindJoystickDrag() {
    const boundary = document.getElementById('joystick-boundary');
    const knob = document.getElementById('joystick-knob');
    const readout = document.getElementById('joystick-vector-readout');
    
    let isDragging = false;

    const handleDragStart = () => { isDragging = true; };
    
    const handleDragMove = (e) => {
        if (!isDragging) return;
        
        const rect = boundary.getBoundingClientRect();
        const boundaryRadius = rect.width / 2;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const joystickCenterX = rect.left + boundaryRadius;
        const joystickCenterY = rect.top + boundaryRadius;
        
        let deltaX = clientX - joystickCenterX;
        let deltaY = clientY - joystickCenterY;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const limit = boundaryRadius - 16; 
        
        if (distance > limit) {
            deltaX = (deltaX / distance) * limit;
            deltaY = (deltaY / distance) * limit;
        }
        
        knob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        const normX = (deltaX / limit).toFixed(2);
        const normY = (deltaY / limit).toFixed(2);
        
        appState.windOverrideVector = { x: parseFloat(normX), y: parseFloat(normY) };
        readout.textContent = `VECTOR: [${normX}, ${normY}]`;
        
        triggerSliderTick(); 
    };

    const handleDragEnd = () => { isDragging = false; };

    knob.addEventListener('mousedown', handleDragStart);
    knob.addEventListener('touchstart', handleDragStart);

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('touchmove', handleDragMove, { passive: false });

    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);
})();

window.resetWindVectorJoystick = function() {
    const knob = document.getElementById('joystick-knob');
    const readout = document.getElementById('joystick-vector-readout');
    
    knob.style.transform = 'translate(0px, 0px)';
    appState.windOverrideVector = { x: 0, y: 0 };
    readout.textContent = `VECTOR: [0.00, 0.00]`;
    
    playUiTone(350, 0.15, "triangle", 0.05);
};

let searchDebounceTimer;
DOM.citySearch.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (query.length === 0) {
        DOM.clearSearch.classList.add('hidden');
        DOM.autocompleteResults.classList.add('hidden');
        return;
    }

    DOM.clearSearch.classList.remove('hidden');
    
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        fetchAutocompleteGeocodes(query);
    }, 300);
});

DOM.clearSearch.addEventListener('click', () => {
    DOM.citySearch.value = '';
    DOM.clearSearch.classList.add('hidden');
    DOM.autocompleteResults.classList.add('hidden');
    DOM.citySearch.focus();
    playUiTone(400, 0.1, "sine", 0.03);
});

async function fetchAutocompleteGeocodes(query) {
    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
        if (!response.ok) throw new Error("Geocoding validation error.");
        
        const data = await response.json();
        renderAutocompleteList(data.results || []);
    } catch (err) {
        console.error("Geocoding service error:", err);
    }
}

function renderAutocompleteList(results) {
    if (results.length === 0) {
        DOM.autocompleteResults.innerHTML = `<div class="p-4 text-xs text-sky-200/30 text-center font-bold tracking-widest uppercase">No Coordinates Found</div>`;
        DOM.autocompleteResults.classList.remove('hidden');
        return;
    }

    DOM.autocompleteResults.innerHTML = results.map(item => {
        const administrativeSection = [item.admin1, item.country].filter(Boolean).join(', ');
        return `
            <div class="p-3.5 hover:bg-white/5 rounded-2xl cursor-pointer transition flex items-center justify-between text-sm border-b border-white/5 last:border-0 group" 
                 onclick="selectStationCoordinates(${item.latitude}, ${item.longitude}, '${item.name.replace(/'/g, "\\'")}', '${item.country_code}')">
                <div>
                    <span class="font-extrabold text-white group-hover:text-sky-300 transition duration-300">${item.name}</span>
                    <span class="text-xs text-sky-200/40 block font-medium mt-0.5">${administrativeSection}</span>
                </div>
                <span class="text-[9px] font-extrabold px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-400/20 uppercase tracking-widest">${item.country_code || '--'}</span>
            </div>
        `;
    }).join('');
    DOM.autocompleteResults.classList.remove('hidden');
}

window.selectStationCoordinates = function(lat, lon, cityName, countryCode) {
    appState.currentCoords = { lat, lon };
    appState.currentLocationName = cityName;
    appState.currentCountry = countryCode || "GL";
    
    DOM.citySearch.value = '';
    DOM.clearSearch.classList.add('hidden');
    DOM.autocompleteResults.classList.add('hidden');
    
    updateRecentSearches(cityName, countryCode, lat, lon);
    synchronizeMeteorologicalData();
    
    triggerInteractiveAlert("success");
};

document.addEventListener('click', (e) => {
    if (!DOM.citySearch.contains(e.target) && !DOM.autocompleteResults.contains(e.target)) {
        DOM.autocompleteResults.classList.add('hidden');
    }
});

function updateRecentSearches(name, country, lat, lon) {
    appState.recents = appState.recents.filter(item => item.name !== name);
    appState.recents.unshift({ name, country, lat, lon });
    if (appState.recents.length > 3) appState.recents.pop();

    localStorage.setItem('atmosphere_recents_premium', JSON.stringify(appState.recents));
    renderRecentSearchesTray();
}

function renderRecentSearchesTray() {
    const tray = document.getElementById('recent-cities-tray');
    if (appState.recents.length === 0) {
        tray.innerHTML = `<span class="text-sky-200/30 italic">No search history</span>`;
        return;
    }

    tray.innerHTML = appState.recents.map(item => {
        return `
            <button onclick="selectStationCoordinates(${item.lat}, ${item.lon}, '${item.name.replace(/'/g, "\\'")}', '${item.country}')" 
                    class="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition font-medium border border-white/5">
                ${item.name}
            </button>
        `;
    }).join('');
}

async function synchronizeMeteorologicalData() {
    if (appState.sandboxMode) return; 

    const { lat, lon } = appState.currentCoords;
    DOM.mapCoords.textContent = `LAT: ${lat.toFixed(4)} / LON: ${lon.toFixed(4)}`;

    try {
        const meteoQueryUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,weather_code,uv_index,is_day,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        const pollutionQueryUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone`;

        const [meteoResponse, pollutionResponse] = await Promise.all([
            fetch(meteoQueryUrl),
            fetch(pollutionQueryUrl)
        ]);

        if (!meteoResponse.ok || !pollutionResponse.ok) throw new Error("Data retrieval failure.");

        appState.weatherData = await meteoResponse.json();
        appState.airQualityData = await pollutionResponse.json();

        updateMeteorologicalDashboard();
        synchronizeRadarLocation();
        resetTimelineSlider();
        renderExtendedWeeklyOutlook();
        updateDetailedPollutantDials();
        
        setTimeout(() => {
            if (appState.bgAnimationEngine) appState.bgAnimationEngine.updatePanelRects();
        }, 500);

    } catch (err) {
        console.error("Critical Synchronization Error:", err);
        renderUserFeedbackToast("Coordinate telemetry alignment error.", "error");
    }
}

function updateMeteorologicalDashboard() {
    const cur = appState.weatherData.current;
    const daily = appState.weatherData.daily;
    const hourIndex = new Date().getHours();
    const meta = getWeatherMeta(cur.weather_code);

    DOM.currentLocation.textContent = appState.currentLocationName;
    DOM.countryBadge.textContent = appState.currentCountry;
    DOM.currentDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();

    appState.bgAnimationEngine.setWeather(meta.icon, cur.is_day === 1);

    if (cur.is_day === 1) {
        DOM.dayNightBadge.innerHTML = `<i class="fa-solid fa-sun text-amber-400 animate-pulse"></i> Daytime Solar Cycle`;
        DOM.dayNightBadge.className = "text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl glass-card text-amber-400 flex items-center gap-2 uppercase tracking-wider border border-amber-400/10";
    } else {
        DOM.dayNightBadge.innerHTML = `<i class="fa-solid fa-moon text-indigo-400 animate-pulse"></i> Dusk Occultation`;
        DOM.dayNightBadge.className = "text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl glass-card text-indigo-400 flex items-center gap-2 uppercase tracking-wider border border-indigo-400/10";
    }

    DOM.currentTemp.textContent = Math.round(cur.temperature_2m);
    DOM.feelsLike.textContent = Math.round(cur.apparent_temperature);
    DOM.highTemp.textContent = Math.round(daily.temperature_2m_max[0]);
    DOM.lowTemp.textContent = Math.round(daily.temperature_2m_min[0]);
    DOM.precipProb.textContent = appState.weatherData.hourly.precipitation_probability[hourIndex];

    DOM.heroWeatherIconContainer.innerHTML = SVGVectors[meta.icon](cur.is_day === 1);
    DOM.weatherDescription.textContent = meta.desc;

    const usAqi = appState.airQualityData.current.us_aqi;
    DOM.aqiRingVal.textContent = usAqi;
    const aqiPercent = Math.min(100, (usAqi / 300) * 100);
    DOM.aqiRingStroke.style.strokeDasharray = `${aqiPercent}, 100`;

    let aqiText = "Good (Low risk)", aqiBadgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-400/20";
    if (usAqi > 50 && usAqi <= 100) {
        aqiText = "Moderate";
        aqiBadgeClass = "bg-yellow-500/10 text-yellow-400 border border-yellow-400/20";
        DOM.aqiRingStroke.style.stroke = "#f59e0b";
    } else if (usAqi > 100 && usAqi <= 150) {
        aqiText = "Unhealthy (S.)";
        aqiBadgeClass = "bg-orange-500/10 text-orange-400 border border-orange-400/20";
        DOM.aqiRingStroke.style.stroke = "#f97316";
    } else if (usAqi > 150) {
        aqiText = "Unhealthy Air";
        aqiBadgeClass = "bg-red-500/10 text-red-400 border border-red-400/20";
        DOM.aqiRingStroke.style.stroke = "#ef4444";
    } else {
        DOM.aqiRingStroke.style.stroke = "#34d399";
    }
    DOM.aqiValue.textContent = usAqi;
    DOM.aqiBadge.textContent = aqiText;
    DOM.aqiBadge.className = `text-[9px] px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-widest ${aqiBadgeClass}`;

    const uvIndex = appState.weatherData.hourly.uv_index[hourIndex] || 0;
    DOM.uvRingVal.textContent = Math.round(uvIndex);
    const uvPercent = Math.min(100, (uvIndex / 12) * 100);
    DOM.uvRingStroke.style.strokeDasharray = `${uvPercent}, 100`;

    let uvText = "Minimal Risk", uvBadgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-400/20";
    if (uvIndex > 2 && uvIndex <= 5) {
        uvText = "Moderate Exposure";
        uvBadgeClass = "bg-yellow-500/10 text-yellow-400 border border-yellow-400/20";
        DOM.uvRingStroke.style.stroke = "#f59e0b";
    } else if (uvIndex > 5 && uvIndex <= 7) {
        uvText = "High Intensity";
        uvBadgeClass = "bg-orange-500/10 text-orange-400 border border-orange-400/20";
        DOM.uvRingStroke.style.stroke = "#f97316";
    } else if (uvIndex > 7) {
        uvText = "Severe Hazards";
        uvBadgeClass = "bg-red-500/10 text-red-400 border border-red-400/20";
        DOM.uvRingStroke.style.stroke = "#ef4444";
    } else {
        DOM.uvRingStroke.style.stroke = "#34d399";
    }
    DOM.uvValue.textContent = uvIndex.toFixed(1);
    DOM.uvBadge.textContent = uvText;
    DOM.uvBadge.className = `text-[9px] px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-widest ${uvBadgeClass}`;

    const rh = cur.relative_humidity_2m;
    DOM.humidityRingVal.textContent = `${rh}%`;
    DOM.humidityRingStroke.style.strokeDasharray = `${rh}, 100`;
    DOM.humidityValue.textContent = `${rh}%`;
    const dewEst = cur.temperature_2m - ((100 - rh) / 5);
    DOM.dewPoint.textContent = `Dew point estimate: ${dewEst.toFixed(1)}°C`;

    DOM.windSpeed.textContent = `${cur.wind_speed_10m} km/h`;
    DOM.windDirectionDegrees.textContent = `${cur.wind_direction_10m}° ${getCardinalWindDirection(cur.wind_direction_10m)}`;
    
    const compassNeedle = document.getElementById('wind-compass-icon');
    if (compassNeedle) {
        compassNeedle.style.transform = `rotate(${cur.wind_direction_10m}deg)`;
    }

    const gustValue = (cur.wind_speed_10m * 1.35).toFixed(1);
    DOM.windGusts.textContent = `Gusting speed: ${gustValue} km/h`;

    DOM.sunriseTime.textContent = formatTimeIsoStr(daily.sunrise[0]);
    DOM.sunsetTime.textContent = formatTimeIsoStr(daily.sunset[0]);

    if (appState.audioSynth && appState.audioSynth.playing) {
        appState.audioSynth.adjustSoundscapeLevels(meta.icon, cur.is_day === 1);
    }

    if (appState.zenActive) {
        renderZenStats();
    }

    synchronizeFavoriteStarState();
}

function updateDetailedPollutantDials() {
    const curPoll = appState.airQualityData.current;
    
    document.getElementById('val-pm25').textContent = `${Math.round(curPoll.pm2_5)} µg/m³`;
    document.getElementById('val-pm10').textContent = `${Math.round(curPoll.pm10)} µg/m³`;
    document.getElementById('val-no2').textContent = `${Math.round(curPoll.nitrogen_dioxide)} µg/m³`;
    document.getElementById('val-o3').textContent = `${Math.round(curPoll.ozone)} µg/m³`;

    document.getElementById('bar-pm25').style.width = `${Math.min(100, (curPoll.pm2_5 / 75) * 100)}%`;
    document.getElementById('bar-pm10').style.width = `${Math.min(100, (curPoll.pm10 / 150) * 100)}%`;
    document.getElementById('bar-no2').style.width = `${Math.min(100, (curPoll.nitrogen_dioxide / 200) * 100)}%`;
    document.getElementById('bar-o3').style.width = `${Math.min(100, (curPoll.ozone / 180) * 100)}%`;
}

function getCardinalWindDirection(deg) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const val = Math.floor((deg / 22.5) + 0.5);
    return directions[val % 16];
}

function formatTimeIsoStr(iso) {
    const parsed = new Date(iso);
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function resetTimelineSlider() {
    const activeHour = new Date().getHours();
    DOM.hourlyScrubber.value = activeHour;
    appState.selectedHourIndex = activeHour;
    updateHourSelection(activeHour);
    renderHourlyCarousel();
}

DOM.hourlyScrubber.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    appState.selectedHourIndex = val;
    updateHourSelection(val);
});

function updateHourSelection(h) {
    const hourly = appState.weatherData.hourly;
    const temp = Math.round(hourly.temperature_2m[h]);
    const isNow = h === new Date().getHours();
    
    DOM.selectedHourLabel.innerHTML = `
        ${isNow ? '<span class="text-sky-300">NOW</span> &middot; ' : ''}${h}:00 &middot; <span class="text-white">${temp}°C</span>
    `;

    const cards = document.querySelectorAll('.timeline-hour-card');
    cards.forEach(card => {
        if (parseInt(card.dataset.hour) === h) {
            card.classList.remove('bg-white/5', 'border-transparent');
            card.classList.add('bg-sky-500/10', 'border-sky-400');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            card.classList.add('bg-white/5', 'border-transparent');
            card.classList.remove('bg-sky-500/10', 'border-sky-400');
        }
    });

    const anchors = document.querySelectorAll('.sparkline-dot');
    anchors.forEach(dot => {
        if (parseInt(dot.dataset.hour) === h) {
            dot.setAttribute('r', '6');
            dot.setAttribute('fill', '#ffffff');
            dot.setAttribute('stroke', '#0284c7');
            dot.setAttribute('stroke-width', '3');
        } else {
            dot.setAttribute('r', '3');
            dot.setAttribute('fill', '#38bdf8');
            dot.setAttribute('stroke', 'none');
        }
    });
}

function renderHourlyCarousel() {
    const hourly = appState.weatherData.hourly;
    
    DOM.hourlyCardsScroll.innerHTML = Array.from({ length: 24 }).map((_, index) => {
        const temp = Math.round(hourly.temperature_2m[index]);
        const code = hourly.weather_code[index];
        const meta = getWeatherMeta(code);
        const active = index === appState.selectedHourIndex;

        return `
            <div data-hour="${index}" class="timeline-hour-card flex-shrink-0 w-20 py-4.5 rounded-2xl border cursor-pointer transition-all duration-300 text-center flex flex-col gap-2.5 ${active ? 'bg-sky-500/10 border-sky-400' : 'bg-white/5 border-transparent hover:bg-white/10'}"
                 onclick="scrubToSelectedHour(${index})">
                <span class="text-xs text-sky-200/40 font-bold">${index}:00</span>
                <div class="w-8 h-8 mx-auto filter drop-shadow">
                    ${SVGVectors[meta.icon](hourly.is_day[index] === 1)}
                </div>
                <span class="text-sm font-extrabold text-white">${temp}°C</span>
                <span class="text-[9px] text-sky-300/60 font-bold tracking-wide truncate max-w-[70px] mx-auto uppercase">${meta.desc}</span>
            </div>
        `;
    }).join('');

    computeSparklineCurves();
}

window.scrubToSelectedHour = function(index) {
    DOM.hourlyScrubber.value = index;
    appState.selectedHourIndex = index;
    updateHourSelection(index);
};

function computeSparklineCurves() {
    const temps = appState.weatherData.hourly.temperature_2m.slice(0, 24);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const spanT = (maxT - minT) || 1;

    const width = 500;
    const height = 100;
    const paddingX = 15;
    const paddingY = 15;

    const points = temps.map((t, idx) => {
        const x = paddingX + (idx / 23) * (width - paddingX * 2);
        const y = height - paddingY - ((t - minT) / spanT) * (height - paddingY * 2);
        return { x, y };
    });

    let pathString = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i+1];
        const cpX1 = p0.x + (p1.x - p0.x) / 3;
        const cpY1 = p0.y;
        const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
        const cpY2 = p1.y;
        pathString += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    DOM.graphLine.setAttribute('d', pathString);

    const areaFillString = `${pathString} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`;
    DOM.graphFill.setAttribute('d', areaFillString);

    DOM.graphAnchors.innerHTML = points.map((p, idx) => {
        return `
            <circle class="sparkline-dot cursor-pointer transition-all duration-300" 
                    cx="${p.x}" cy="${p.y}" r="3" fill="#38bdf8" 
                    data-hour="${idx}" onclick="scrubToSelectedHour(${idx})">
                <title>Time ${idx}:00 - Temp: ${temps[idx]}°C</title>
            </circle>
        `;
    }).join('');
}

function renderExtendedWeeklyOutlook() {
    const daily = appState.weatherData.daily;
    const container = DOM.weeklyForecastContainer;
    container.innerHTML = '';

    const maxTotal = Math.max(...daily.temperature_2m_max);
    const minTotal = Math.min(...daily.temperature_2m_min);
    const totalRange = maxTotal - minTotal || 1;

    for (let i = 0; i < 7; i++) {
        const max = Math.round(daily.temperature_2m_max[i]);
        const min = Math.round(daily.temperature_2m_min[i]);
        const code = daily.weather_code[i];
        const meta = getWeatherMeta(code);
        
        const dayDate = new Date(daily.time[i]);
        const dayLabel = i === 0 ? "TODAY" : dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const calendarLabel = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const leftPercent = ((min - minTotal) / totalRange) * 100;
        const widthPercent = ((max - min) / totalRange) * 100;

        const rowHtml = `
            <div class="glass-card p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold gap-4 hover:translate-x-1.5 transition duration-300">
                <div class="w-24 flex-shrink-0">
                    <span class="text-white block font-black">${dayLabel}</span>
                    <span class="text-[9px] text-sky-200/40 uppercase tracking-wider block mt-0.5">${calendarLabel}</span>
                </div>

                <div class="w-8 h-8 flex-shrink-0">
                    ${SVGVectors[meta.icon](true)}
                </div>

                <div class="flex-1 px-4 hidden sm:block">
                    <div class="relative w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div class="absolute h-full rounded-full bg-gradient-to-r from-sky-400 via-teal-300 to-amber-400" 
                             style="left: ${leftPercent}%; width: ${Math.max(8, widthPercent)}%"></div>
                    </div>
                </div>

                <div class="w-16 text-right flex-shrink-0">
                    <span class="text-slate-100 font-extrabold">${max}°</span>
                    <span class="text-sky-300/40 ml-2 font-bold">${min}°</span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', rowHtml);
    }
}

function initializeSynopticMap() {
    const { lat, lon } = appState.currentCoords;
    
    appState.mapInstance = L.map('map-view', {
        zoomControl: false,
        attributionControl: false
    }).setView([lat, lon], 9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18
    }).addTo(appState.mapInstance);

    const proceduralGlassIcon = L.divIcon({
        className: 'custom-radar-pulse-marker',
        html: `<div class="relative w-9 h-9 flex items-center justify-center rounded-full bg-sky-500/20 border-2 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.7)] animate-pulse">
                    <div class="w-2.5 h-2.5 rounded-full bg-white"></div>
               </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    appState.mapMarker = L.marker([lat, lon], { icon: proceduralGlassIcon }).addTo(appState.mapInstance);

    appState.mapInstance.on('click', async (e) => {
        if (appState.sandboxMode) {
            renderUserFeedbackToast("Disable Sandbox Mode to query coordinates!", "warning");
            return;
        }
        
        const { lat, lng } = e.latlng;
        appState.currentCoords = { lat, lon: lng };

        playUiTone(600, 0.2, "sine", 0.05);

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            appState.currentLocationName = data.address.city || data.address.town || data.address.village || "Target Location";
            appState.currentCountry = data.address.country_code ? data.address.country_code.toUpperCase() : "MAP";
        } catch {
            appState.currentLocationName = "Target Location";
            appState.currentCountry = "MAP";
        }

        synchronizeMeteorologicalData();
        renderUserFeedbackToast(`Map targeting: ${appState.currentLocationName}`, "info");
    });
}

function synchronizeRadarLocation() {
    const { lat, lon } = appState.currentCoords;
    if (!appState.mapInstance) return;

    appState.mapInstance.setView([lat, lon], 9);
    appState.mapMarker.setLatLng([lat, lon]);

    appState.mapMarker.bindPopup(`
        <div class="p-2 text-xs font-bold text-slate-800 space-y-1">
            <h5 class="text-sm font-black text-sky-600">${appState.currentLocationName}</h5>
            <p class="text-slate-500">ATMOSPHERIC STATION LOCATED</p>
            <p class="text-[11px]">Temp: ${Math.round(appState.weatherData ? appState.weatherData.current.temperature_2m : 0)}°C &middot; ${appState.weatherData ? appState.weatherData.current.relative_humidity_2m : 0}% Humidity</p>
        </div>
    `, { closeButton: false }).openPopup();
}

DOM.gpsLocateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        renderUserFeedbackToast("Coordinate tracking unsupported by browser.", "error");
        return;
    }

    DOM.gpsLocateBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-sm"></i>`;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        appState.currentCoords = { lat, lon };

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await response.json();
            appState.currentLocationName = data.address.city || data.address.town || data.address.village || "Local Coordinates";
            appState.currentCountry = data.address.country_code ? data.address.country_code.toUpperCase() : "GPS";
        } catch {
            appState.currentLocationName = "Local Coordinates";
            appState.currentCountry = "GPS";
        }

        DOM.gpsLocateBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs text-sm"></i>`;
        synchronizeMeteorologicalData();
        renderUserFeedbackToast("Local coordinate lock obtained successfully.", "info");
        triggerInteractiveAlert("success");
    }, (err) => {
        console.error("GPS telemetry exception:", err);
        renderUserFeedbackToast("GPS coordinate tracking disabled.", "warning");
        DOM.gpsLocateBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs text-sm"></i>`;
        triggerInteractiveAlert("error");
    });
});

function setupSpeechInputDevice() {
    const SpeechRecognitionEngine = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionEngine) {
        DOM.voiceSearchBtn.style.display = 'none';
        return;
    }

    appState.voiceRecognizer = new SpeechRecognitionEngine();
    appState.voiceRecognizer.continuous = false;
    appState.voiceRecognizer.lang = 'en-US';
    appState.voiceRecognizer.interimResults = false;

    appState.voiceRecognizer.onstart = () => {
        DOM.voiceSearchBtn.classList.add('voice-active');
        DOM.citySearch.placeholder = "Listening for coordinate locations...";
        playUiTone(600, 0.15, "triangle", 0.05);
    };

    appState.voiceRecognizer.onresult = async (e) => {
        const phraseStr = e.results[0][0].transcript;
        DOM.citySearch.value = phraseStr;
        DOM.voiceSearchBtn.classList.remove('voice-active');
        DOM.citySearch.placeholder = "Discover a city or coordinates...";
        
        renderUserFeedbackToast(`Vocal input verified: "${phraseStr}"`, "info");
        fetchAutocompleteGeocodes(phraseStr);
        triggerInteractiveAlert("success");
    };

    appState.voiceRecognizer.onerror = (err) => {
        console.error("Speech recognition error:", err);
        DOM.voiceSearchBtn.classList.remove('voice-active');
        DOM.citySearch.placeholder = "Discover a city or coordinates...";
        renderUserFeedbackToast("Voice recognition service error.", "warning");
        triggerInteractiveAlert("error");
    };

    appState.voiceRecognizer.onend = () => {
        DOM.voiceSearchBtn.classList.remove('voice-active');
    };

    DOM.voiceSearchBtn.addEventListener('click', () => {
        try {
            appState.voiceRecognizer.start();
        } catch {
            appState.voiceRecognizer.stop();
        }
    });
}

DOM.addFavoriteBtn.addEventListener('click', () => {
    const existingIdx = appState.favorites.findIndex(item => item.name === appState.currentLocationName && item.country === appState.currentCountry);
    
    DOM.addFavoriteBtn.classList.add('scale-95');
    setTimeout(() => DOM.addFavoriteBtn.classList.remove('scale-95'), 150);

    if (existingIdx > -1) {
        appState.favorites.splice(existingIdx, 1);
        renderUserFeedbackToast(`Removed ${appState.currentLocationName} from Favorites.`, 'info');
        playUiTone(300, 0.15, "sine", 0.05);
    } else {
        appState.favorites.push({
            name: appState.currentLocationName,
            country: appState.currentCountry,
            lat: appState.currentCoords.lat,
            lon: appState.currentCoords.lon
        });
        renderUserFeedbackToast(`Pinned ${appState.currentLocationName} to Favorites.`, 'info');
        playUiTone(900, 0.2, "sine", 0.05);
    }

    localStorage.setItem('atmosphere_favorites_premium', JSON.stringify(appState.favorites));
    synchronizeFavoriteStarState();
    renderFavoritesDrawer();
});

function synchronizeFavoriteStarState() {
    const matched = appState.favorites.some(item => item.name === appState.currentLocationName && item.country === appState.currentCountry);
    const btn = DOM.addFavoriteBtn;
    const star = DOM.favStar;
    const text = DOM.favBtnText;

    if (matched) {
        star.className = "fa-solid fa-star text-yellow-400 text-sm transform scale-110 duration-300 animate-bounce";
        setTimeout(() => star.classList.remove('animate-bounce'), 1000);
        
        text.textContent = "Pinned Location";
        btn.className = "px-5 py-3 rounded-2xl glass-panel text-xs text-yellow-400 bg-yellow-500/10 border-yellow-500/30 flex items-center gap-2.5 font-bold transition-all duration-300 active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.25)]";
    } else {
        star.className = "fa-regular fa-star text-slate-400 text-sm transform scale-100 duration-300";
        text.textContent = "Add to Favorites";
        btn.className = "px-5 py-3 rounded-2xl glass-panel text-xs text-slate-300 hover:text-white flex items-center gap-2.5 font-bold transition-all duration-300 active:scale-95";
    }
}

function renderFavoritesDrawer() {
    const favs = appState.favorites;
    DOM.favCount.textContent = `${favs.length} PINNED`;

    if (favs.length === 0) {
        DOM.favoritesList.innerHTML = `
            <div class="text-center text-xs py-4 text-sky-200/20 font-bold tracking-widest uppercase">
                No pinned locations found
            </div>
        `;
        return;
    }

    DOM.favoritesList.innerHTML = favs.map((item, idx) => {
        return `
            <div class="p-3.5 bg-white/3 rounded-2xl flex items-center justify-between border border-white/5 hover:border-sky-400/30 transition group duration-300">
                <div class="cursor-pointer flex-1" onclick="selectStationCoordinates(${item.lat}, ${item.lon}, '${item.name.replace(/'/g, "\\'")}', '${item.country}')">
                    <h4 class="text-xs font-black text-white group-hover:text-sky-300 transition duration-300">${item.name}</h4>
                    <p class="text-[9px] text-sky-200/40 uppercase font-bold tracking-widest mt-0.5">${item.country} &middot; LAT: ${item.lat.toFixed(2)}</p>
                </div>
                <button class="text-slate-500 hover:text-red-400 p-2 rounded-xl transition duration-300" onclick="removeFavoriteRecord(${idx})">
                    <i class="fa-regular fa-trash-can text-xs"></i>
                </button>
            </div>
        `;
    }).join('');
}

window.removeFavoriteRecord = function(idx) {
    const deleted = appState.favorites.splice(idx, 1)[0];
    localStorage.setItem('atmosphere_favorites_premium', JSON.stringify(appState.favorites));
    renderUserFeedbackToast(`Removed ${deleted.name} from records.`, 'info');
    playUiTone(350, 0.1, "sine", 0.04);
    synchronizeFavoriteStarState();
    renderFavoritesDrawer();
};

function renderUserFeedbackToast(msg, type = "info") {
    const box = document.createElement('div');
    box.className = "fixed bottom-6 right-6 px-5 py-4 rounded-2xl glass-panel shadow-2xl flex items-center gap-3.5 border z-50 transition-all duration-500 transform translate-y-12 opacity-0";
    
    let iconElement = '<i class="fa-solid fa-circle-info text-sky-400"></i>';
    if (type === 'error') {
        iconElement = '<i class="fa-solid fa-triangle-exclamation text-red-400"></i>';
        box.style.borderLeft = "4px solid #f87171";
    } else if (type === 'warning') {
        iconElement = '<i class="fa-solid fa-circle-exclamation text-amber-400"></i>';
        box.style.borderLeft = "4px solid #fbbf24";
    } else {
        box.style.borderLeft = "4px solid #38bdf8";
    }
    
    box.innerHTML = `
        ${iconElement}
        <span class="text-xs text-white font-extrabold tracking-wide uppercase">${msg}</span>
    `;
    document.body.appendChild(box);
    
    setTimeout(() => {
        box.classList.remove('translate-y-12', 'opacity-0');
    }, 50);

    setTimeout(() => {
        box.classList.add('translate-y-12', 'opacity-0');
        setTimeout(() => box.remove(), 500);
    }, 3500);
}

const bootDiagnosticCommands = [
    "CONNECTING TO GLOBAL CLIMATE MET SYNOPTIC SATELLITES...",
    "RETRIEVING OPEN-METEO RADAR MATRIX FEED...",
    "COMPILING PROCEDURAL PARTICLE COLLISIONS & SPLATTERS...",
    "CALIBRATING ATMOSPHERIC VECTOR JOYSTICK CHANNELS...",
    "PRE-RENDERING 3D GLASS PANEL MATRIX GEOMETRIES...",
    "INITIALIZING AUDIO SYNTH AMBIENCE (WEB AUDIO API)...",
    "CALIBRATION OPTIMAL. SYSTEM WELCOMES Bhaveshh."
];

let bootCommandIndex = 0;
let bootProgressValue = 0;
let bootTimer = null;

function renderBootLoaderTypewriter() {
    const logBox = document.getElementById('boot-terminal-lines');
    if (bootCommandIndex < bootDiagnosticCommands.length) {
        const line = document.createElement('div');
        line.className = "flex gap-2 animate-pulse";
        line.innerHTML = `<span class="text-sky-400 font-bold">></span> <span>${bootDiagnosticCommands[bootCommandIndex]}</span>`;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
        
        playUiTone(800 + (bootCommandIndex * 80), 0.03, "sine", 0.02);

        bootCommandIndex++;
        setTimeout(renderBootLoaderTypewriter, 350);
    }
}

function runDiagnosticProgressBar() {
    const progressBar = document.getElementById('boot-progress-bar');
    const progressPct = document.getElementById('boot-progress-percentage');
    const statusText = document.getElementById('boot-status-text');

    const statusMessages = [
        "Calibrating Transceivers...",
        "Mapping Card Geometries...",
        "Synthesizing Soundwaves...",
        "Synoptic Locks Complete!"
    ];

    bootTimer = setInterval(() => {
        bootProgressValue += Math.floor(Math.random() * 6) + 3;
        if (bootProgressValue >= 100) {
            bootProgressValue = 100;
            clearInterval(bootTimer);
            concludeBootSequence();
        }
        
        progressBar.style.width = `${bootProgressValue}%`;
        progressPct.textContent = `${bootProgressValue}%`;

        const msgIndex = Math.min(statusMessages.length - 1, Math.floor((bootProgressValue / 100) * statusMessages.length));
        statusText.textContent = statusMessages[msgIndex];
    }, 80);
}

function concludeBootSequence() {
    const loader = document.getElementById('system-boot-loader');
    const mainApp = document.getElementById('main-app-content');

    playUiTone(523.25, 0.25, "triangle", 0.08);
    setTimeout(() => playUiTone(659.25, 0.25, "sine", 0.08), 120);
    setTimeout(() => playUiTone(783.99, 0.35, "sine", 0.08), 240);
    setTimeout(() => playUiTone(1046.50, 0.5, "sine", 0.08), 360);

    loader.classList.add('opacity-0', 'scale-110', 'pointer-events-none');
    mainApp.classList.remove('opacity-0', 'scale-[0.98]');

    renderUserFeedbackToast("ATMOSPHERE Station Fully Calibrated", "success");
    
    setTimeout(() => {
        if (appState.mapInstance) {
            appState.mapInstance.invalidateSize();
        }
    }, 300);

    setTimeout(() => {
        loader.remove();
    }, 1000);
}

window.skipBootSequence = function() {
    clearInterval(bootTimer);
    concludeBootSequence();
};

window.onload = function () {
    appState.bgAnimationEngine = new WeatherPhysicsEngine(DOM.canvas);
    
    // Initiate Cybernetic System Diagnostic Sequence
    renderBootLoaderTypewriter();
    runDiagnosticProgressBar();

    initializeSynopticMap();
    synchronizeMeteorologicalData();
    
    setupSpeechInputDevice();
    renderFavoritesDrawer();
    renderRecentSearchesTray();
    
    setupPremiumTiltInteractivity();
};
const fs = require('fs');
const script = fs.readFileSync('src/script.js', 'utf8');

// Check class methods in WeatherPhysicsEngine and WeatherSoundGenerator
const classes = [...script.matchAll(/class\s+([A-Za-z0-9_$]+)\s*\{([\s\S]*?)\n\}/g)];
classes.forEach(c => {
    const className = c[1];
    const classBody = c[2];
    console.log('Class:', className);
    const methods = [...classBody.matchAll(/^\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/gm)].map(m => m[1]);
    methods.forEach(m => {
        // count how many times method name appears in whole script
        const count = [...script.matchAll(new RegExp('\\b' + m + '\\b', 'g'))].length;
        if (count <= 1) {
            console.log(`  Unused method in ${className}:`, m);
        }
    });
});
