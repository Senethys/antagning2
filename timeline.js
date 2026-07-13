// Remove the CSS injection since it's handled by the manifest
console.log('Timeline script loaded!');

class CourseTimeline {
    constructor() {
        console.log('CourseTimeline initialized');
        this.totalHPByTerm = {};
        this.courseSchedulesByTerm = new Map();
        this.studietaktViews = new Map();
        this.fullTimeHpPerWeek = 1.5;
        this.currentDate = new Date().toISOString();
        this.termInfo = {
            'VT': { start: 3, end: 23 },
            'HT': { start: 36, end: 52 }
        };
        this.timelineGrids = new Map(); // Store timeline grids by term
        this.initializeTimelineContainer();
    }

    initializeTimelineContainer() {
        console.log('Initializing timeline container');
        
        // First check if container already exists
        let timelineContainer = document.getElementById('course-timelines-container');
        if (timelineContainer) {
            console.log('Timeline container already exists');
            return;
        }

        // Determine appropriate parent element
        let parentElement;
        if (window.location.href.indexOf('selections') !== -1) {
            parentElement = document.body;
        } else {
            parentElement = document.querySelector('.resultsection') || 
                            document.querySelector('#result_list_anchor') ||
                            document.querySelector('#showfilterscontainer');
        }
        if (!parentElement) {
            console.log('Could not find a suitable container, waiting for DOM...');
            setTimeout(() => this.initializeTimelineContainer(), 500);
            return;
        }

        // Create the timeline container
        timelineContainer = document.createElement('div');
        timelineContainer.id = 'course-timelines-container';
        timelineContainer.className = 'course-timelines-container';
        timelineContainer.style.margin = '20px 0';
        timelineContainer.style.padding = '20px';
        timelineContainer.style.backgroundColor = '#f8f8f8';
        timelineContainer.style.border = '1px solid #e0e0e0';
        timelineContainer.style.borderRadius = '8px';
        timelineContainer.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

        // Add legend at the top
        this.addLegend(timelineContainer);
        
        // Insert the container in the appropriate place
        if (parentElement.parentNode) {
            try {
                parentElement.parentNode.insertBefore(timelineContainer, parentElement);
                console.log('Timeline container created and inserted');
            } catch (error) {
                console.error('Error inserting timeline container:', error);
                // Fallback: try to append to the parent instead
                try {
                    parentElement.parentNode.appendChild(timelineContainer);
                    console.log('Timeline container appended as fallback');
                } catch (error) {
                    console.error('Failed to insert timeline container:', error);
                }
            }
        } else {
            console.error('Could not find parent node for insertion');
        }
    }

    getOrCreateTimelineForTerm(term, year) {
        const termKey = `${term}${year}`;
        const container = document.getElementById('course-timelines-container');
        
        if (!container) {
            console.error('Timeline container not found');
            return null;
        }
        
        if (!this.timelineGrids.has(termKey)) {
            console.log('Creating new timeline for term:', termKey);
            
            // Create term section
            const termSection = document.createElement('div');
            termSection.className = 'term-section';
            termSection.style.marginBottom = '30px';
            
            // Add term header
            const termHeader = document.createElement('div');
            termHeader.className = 'term-header';
            termHeader.style.marginBottom = '15px';
            termHeader.style.display = 'flex';
            termHeader.style.justifyContent = 'space-between';
            termHeader.style.alignItems = 'center';
            
            const termTitle = document.createElement('h3');
            termTitle.textContent = `${term} ${year}`;
            termTitle.style.margin = '0';
            termTitle.style.fontSize = '18px';
            termTitle.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';
            
            const hpDisplay = document.createElement('div');
            hpDisplay.id = `total-hp-display-${termKey}`;
            hpDisplay.textContent = 'Totalt: 0 hp';
            hpDisplay.style.fontSize = '14px';
            hpDisplay.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';
            
            termHeader.appendChild(termTitle);
            termHeader.appendChild(hpDisplay);
            termSection.appendChild(termHeader);

            // Create timeline container
            const timelineContainer = document.createElement('div');
            timelineContainer.className = 'timeline-container';
            timelineContainer.style.backgroundColor = '#f8f8f8';
            timelineContainer.style.padding = '15px';
            timelineContainer.style.borderRadius = '8px';
            
            // Add week indicators
            const weekIndicators = document.createElement('div');
            weekIndicators.className = 'week-indicators';
            weekIndicators.style.display = 'flex';
            weekIndicators.style.justifyContent = 'space-between';
            weekIndicators.style.padding = '0 20px';
            weekIndicators.style.marginBottom = '10px';
            weekIndicators.style.color = '#666';
            weekIndicators.style.fontSize = '12px';
            
            const termConfig = this.termInfo[term];
            for (let week = termConfig.start; week <= termConfig.end; week += 5) {
                const indicator = document.createElement('span');
                indicator.textContent = `v.${week}`;
                weekIndicators.appendChild(indicator);
            }
            
            timelineContainer.appendChild(weekIndicators);

            // Add timeline grid
            const timelineGrid = document.createElement('div');
            timelineGrid.id = `timeline-grid-${termKey}`;
            timelineGrid.style.display = 'flex';
            timelineGrid.style.flexDirection = 'column';
            timelineGrid.style.gap = '10px';
            
            timelineContainer.appendChild(timelineGrid);
            const studietaktView = this.createStudietaktView(termKey);
            timelineContainer.appendChild(studietaktView);
            termSection.appendChild(timelineContainer);
            container.appendChild(termSection);
            
            this.timelineGrids.set(termKey, timelineGrid);
            this.courseSchedulesByTerm.set(termKey, []);
            this.totalHPByTerm[termKey] = 0;
            this.updateStudietaktSummary(termKey);
        }
        
        return this.timelineGrids.get(termKey);
    }

    createStudietaktView(termKey) {
        const wrapper = document.createElement('div');
        wrapper.className = 'studietakt-summary';
        wrapper.id = `studietakt-summary-${termKey}`;
        wrapper.style.marginTop = '15px';
        wrapper.style.padding = '12px 15px';
        wrapper.style.backgroundColor = '#ffffff';
        wrapper.style.border = '1px solid #e0e0e0';
        wrapper.style.borderRadius = '8px';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '8px';
        wrapper.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('span');
        title.textContent = 'Studietakt';
        title.style.fontSize = '14px';
        title.style.fontWeight = '600';
        title.style.color = '#333';

        const overall = document.createElement('span');
        overall.className = 'studietakt-summary-overall';
        overall.style.fontSize = '13px';
        overall.style.color = '#333';
        overall.textContent = 'Genomsnitt: 0% - 0 hp';

        header.appendChild(title);
        header.appendChild(overall);

        const info = document.createElement('div');
        info.className = 'studietakt-summary-info';
        info.style.fontSize = '12px';
        info.style.color = '#666';
        info.textContent = 'Beräknat utifrån 30 hp på 20 veckor (1.5 hp/vecka = 100%).';

        const empty = document.createElement('div');
        empty.className = 'studietakt-summary-empty';
        empty.style.fontSize = '12px';
        empty.style.color = '#666';
        empty.textContent = 'Inga valda kurser ännu.';

        const periods = document.createElement('div');
        periods.className = 'studietakt-summary-periods';
        periods.style.display = 'none';
        periods.style.flexDirection = 'column';
        periods.style.gap = '6px';

        wrapper.appendChild(header);
        wrapper.appendChild(info);
        wrapper.appendChild(empty);
        wrapper.appendChild(periods);

        this.studietaktViews.set(termKey, {
            container: wrapper,
            overall,
            info,
            periods,
            empty
        });

        return wrapper;
    }

    updateTotalHP(hp, termKey) {
        this.totalHPByTerm[termKey] = hp;
        const display = document.getElementById(`total-hp-display-${termKey}`);
        if (display) {
            display.textContent = `Totalt: ${hp} hp`;
        }
    }

    addLegend(timelineContainer) {
        // Add legend at the bottom
        const legend = document.createElement('div');
        legend.style.marginTop = '20px';
        legend.style.padding = '10px';
        legend.style.borderTop = '1px solid #e0e0e0';
        legend.style.display = 'flex';
        legend.style.flexWrap = 'wrap';
        legend.style.gap = '15px';
        legend.style.fontSize = '12px';
        legend.style.color = '#666';
        legend.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';

        const legendItems = [
            { color: '#4CAF50', text: '100%' },
            { color: '#26A69A', text: '75%' },
            { color: '#FFA726', text: '50%' },
            { color: '#5C6BC0', text: '25%' },
            { color: '#7E57C2', text: '20%' },
            { color: '#EF5350', text: '10%' }
        ];

        legendItems.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.gap = '5px';

            const colorBox = document.createElement('div');
            colorBox.style.width = '20px';
            colorBox.style.height = '10px';
            colorBox.style.backgroundColor = item.color;
            colorBox.style.borderRadius = '4px';

            const text = document.createElement('span');
            text.textContent = `Studietakt: ${item.text}`;
            text.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';

            legendItem.appendChild(colorBox);
            legendItem.appendChild(text);
            legend.appendChild(legendItem);
        });

        // Add overflow indicator to legend
        const overflowLegend = document.createElement('div');
        overflowLegend.style.display = 'flex';
        overflowLegend.style.alignItems = 'center';
        overflowLegend.style.gap = '5px';

        const overflowBox = document.createElement('div');
        overflowBox.style.width = '20px';
        overflowBox.style.height = '10px';
        overflowBox.style.backgroundImage = `repeating-linear-gradient(
            45deg,
            #666,
            #666 2px,
            #fff 2px,
            #fff 4px
        )`;
        overflowBox.style.borderRadius = '4px';

        const overflowText = document.createElement('span');
        overflowText.textContent = 'Fortsätter efter terminsslut';
        overflowText.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';

        overflowLegend.appendChild(overflowBox);
        overflowLegend.appendChild(overflowText);
        legend.appendChild(overflowLegend);

        timelineContainer.appendChild(legend);
    }

    addCourseToTimeline(courseElement) {
        console.log('Adding course to timeline');
        
        // Extract term information
        const { term, year } = this.extractTermInfo(courseElement);
        console.log('Extracted term info:', term, year);
        
        if (!term || !year) {
            console.error('Could not extract term info');
            return;
        }

        // Get timeline grid for this term
        const timelineGrid = this.getOrCreateTimelineForTerm(term, year);
        if (!timelineGrid) {
            console.error('Could not get timeline grid');
            // Try to initialize the container again
            this.initializeTimelineContainer();
            return;
        }

        const termKey = `${term}${year}`;
        
        // Extract course information
        const courseId = courseElement.querySelector('button.toggleselection').getAttribute('data-id');
        const courseName = courseElement.querySelector('.headline4').textContent;
        const coursePoints = courseElement.querySelector('.universal_medium').textContent.split(',')[0].trim().replace(/[^\d.]/g, '');
        const hpValue = parseFloat(coursePoints);
        const studietakt = this.extractStudietakt(courseElement);
        const startPeriod = this.extractStartPeriod(courseElement);
        
        if (!startPeriod) {
            console.error('Could not extract start period');
            return;
        }

        // Calculate course duration and position
        const durationWeeks = this.calculateCourseDuration(hpValue, studietakt);
        const { startPosition, width } = this.calculateTimelinePosition(startPeriod, durationWeeks, this.termInfo[term]);
        
        // Check if course extends beyond term end
        const isOverflowing = (startPosition + width) > 100;
        const actualWidth = isOverflowing ? 100 - startPosition : width;

        // Create course element
        const courseBar = document.createElement('div');
        courseBar.id = `timeline-${courseId}`;
        courseBar.className = 'course-timeline-item';
        courseBar.style.position = 'relative';
        courseBar.style.height = '30px';
        courseBar.style.backgroundColor = '#f0f0f0';
        courseBar.style.borderRadius = '4px';
        courseBar.style.marginBottom = '5px';
        
        // Create course progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'course-progress';
        progressBar.style.position = 'absolute';
        progressBar.style.left = startPosition + '%';
        progressBar.style.width = actualWidth + '%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = this.getStudietaktColor(studietakt);
        progressBar.style.borderRadius = '4px';
        
        // Add diagonal stripes pattern for courses that extend beyond term end
        if (isOverflowing) {
            const overflowBar = document.createElement('div');
            overflowBar.style.position = 'absolute';
            overflowBar.style.right = '0';
            overflowBar.style.width = '30%';  // Show pattern on the right portion
            overflowBar.style.height = '100%';
            overflowBar.style.backgroundImage = 'repeating-linear-gradient(45deg, #666, #666 2px, transparent 2px, transparent 4px)';
            overflowBar.style.borderRadius = '0 4px 4px 0';
            progressBar.appendChild(overflowBar);
        }
        
        // Add course label
        const label = document.createElement('div');
        label.className = 'course-label';
        label.style.position = 'absolute';
        label.style.left = '10px';
        label.style.top = '50%';
        label.style.transform = 'translateY(-50%)';
        label.style.color = '#333';
        label.style.fontSize = '12px';
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.maxWidth = 'calc(100% - 20px)';
        label.style.fontFamily = 'Open Sans, Helvetica, Arial, sans-serif';
        label.textContent = `${courseName} (${coursePoints}hp)`;
        
        courseBar.appendChild(progressBar);
        courseBar.appendChild(label);
        timelineGrid.appendChild(courseBar);
        
        // Update total HP for the term
        this.storeCourseSchedule(termKey, {
            id: courseId,
            name: courseName,
            hp: hpValue,
            studietakt,
            startWeek: startPeriod,
            durationWeeks,
            endWeek: startPeriod + durationWeeks - 1
        });
        this.updateTotalHP(this.totalHPByTerm[termKey] + hpValue, termKey);
        this.updateStudietaktSummary(termKey);
    }

    extractTermInfo(courseElement) {
        const courseDetails = courseElement.textContent;
        let term, year;

        // Try to find term and year from the course details
        const termMatch = courseDetails.match(/(Hösten|Våren)\s*(20\d{2})/);
        if (termMatch) {
            term = termMatch[1] === 'Hösten' ? 'HT' : 'VT';
            year = termMatch[2];
        } else {
            // If not found in text, try to extract from button ID
            const buttonId = courseElement.querySelector('button[id^="info-"]')?.id || '';
            const buttonMatch = buttonId.match(/info-(HT|VT)(20\d{2})/);
            
            if (buttonMatch) {
                term = buttonMatch[1];
                year = buttonMatch[2];
            } else {
                // As a last resort, use current date to determine next possible term
                const currentDate = new Date(this.currentDate);
                const currentMonth = currentDate.getMonth() + 1; // 0-based
                const currentYear = currentDate.getFullYear();
                
                // If we're in the application period for autumn (before January 15)
                // or spring (before July 15), use the next term
                if (currentMonth <= 1 || (currentMonth === 1 && currentDate.getDate() <= 15)) {
                    // Application period for autumn term
                    term = 'VT';
                    year = currentYear.toString();
                } else if (currentMonth <= 7 && (currentMonth < 7 || currentDate.getDate() <= 15)) {
                    // Application period for spring term
                    term = 'HT';
                    year = currentYear.toString();
                } else {
                    // Application period for next year's spring term
                    term = 'VT';
                    year = (currentYear + 1).toString();
                }
            }
        }

        console.log(`Extracted term info: ${term} ${year}`);
        return { term, year };
    }

    extractStartPeriod(courseElement) {
        const courseDetails = courseElement.textContent;
        const termInfo = this.extractTermInfo(courseElement);
        const termConfig = this.termInfo[termInfo.term];
        
        // Check for specific period mentions
        if (courseDetails.includes('Period 1')) {
            return termConfig.start;
        }
        if (courseDetails.includes('Period 2')) {
            return termConfig.start + 10;
        }

        // Look for explicit week number
        const weekMatch = courseDetails.match(/[Vv]ecka (\d+)/);
        if (weekMatch) {
            const week = parseInt(weekMatch[1]);
            // Validate that the week is within the term's range
            if (week >= termConfig.start && week <= termConfig.end) {
                return week;
            }
        }

        // Default to term start if no specific information found
        return termConfig.start;
    }

    extractStudietakt(courseElement) {
        const courseDetails = courseElement.textContent;
        if (courseDetails.includes('Helfart')) return 100;
        if (courseDetails.includes('Trekvartsfart')) return 75;
        if (courseDetails.includes('Halvfart')) return 50;
        if (courseDetails.includes('Kvartsfart')) return 25;
        // Try to find percentage if explicitly stated
        const percentMatch = courseDetails.match(/(\d+)%/);
        if (percentMatch) return parseInt(percentMatch[1]);
        // Default to full-time if not specified
        return 100;
    }

    calculateCourseDuration(hp, studietakt) {
        // Base duration for full-time studies (1.5 hp per week)
        const baseWeeks = hp / 1.5;
        // Adjust duration based on studietakt (e.g., halvfart takes twice as long)
        return Math.ceil(baseWeeks * (100 / studietakt));
    }

    getStudietaktColor(studietakt) {
        switch (studietakt) {
            case 100: return '#4CAF50';  // Green
            case 75: return '#26A69A';   // Teal
            case 50: return '#FFA726';   // Orange
            case 25: return '#5C6BC0';   // Indigo
            case 20: return '#7E57C2';   // Deep Purple
            case 10: return '#EF5350';   // Red
            default: return '#4CAF50';   // Default to green
        }
    }

    calculateTimelinePosition(startWeek, duration, termConfig) {
        const termLength = termConfig.end - termConfig.start;
        let startPosition = ((startWeek - termConfig.start) / termLength) * 100;
        let width = (duration / termLength) * 100;
        
        return {
            startPosition: Math.max(0, startPosition),
            width: Math.max(0, width)
        };
    }

    storeCourseSchedule(termKey, courseData) {
        const schedules = this.courseSchedulesByTerm.get(termKey) || [];
        const existingIndex = schedules.findIndex(course => course.id === courseData.id);
        
        if (existingIndex !== -1) {
            schedules[existingIndex] = courseData;
        } else {
            schedules.push(courseData);
        }

        this.courseSchedulesByTerm.set(termKey, schedules);
    }

    removeCourseSchedule(termKey, courseId) {
        const schedules = this.courseSchedulesByTerm.get(termKey);
        if (!schedules) {
            return;
        }
        const updatedSchedules = schedules.filter(course => course.id !== courseId);
        this.courseSchedulesByTerm.set(termKey, updatedSchedules);
    }

    getCourseSchedules(termKey) {
        return this.courseSchedulesByTerm.get(termKey) || [];
    }

    updateStudietaktSummary(termKey) {
        let view = this.studietaktViews.get(termKey);
        if (!view) {
            const timelineGrid = this.timelineGrids.get(termKey);
            if (timelineGrid && timelineGrid.parentElement) {
                const newView = this.createStudietaktView(termKey);
                timelineGrid.parentElement.appendChild(newView);
                view = this.studietaktViews.get(termKey);
            } else {
                return;
            }
        }

        const { overall, periods, empty } = view;
        const termCode = termKey.slice(0, 2);
        const termConfig = this.termInfo[termCode];

        if (!termConfig) {
            overall.textContent = 'Genomsnitt: 0% - 0 hp';
            periods.innerHTML = '';
            periods.style.display = 'none';
            empty.style.display = 'block';
            empty.textContent = 'Kan inte räkna ut studietakten för den här terminen.';
            return;
        }

        const courses = this.getCourseSchedules(termKey).filter(course => course.durationWeeks > 0);
        if (!courses.length) {
            overall.textContent = 'Genomsnitt: 0% - 0 hp';
            periods.innerHTML = '';
            periods.style.display = 'none';
            empty.style.display = 'block';
            empty.textContent = 'Inga valda kurser ännu.';
            return;
        }

        const analysisStart = termConfig.start;
        const analysisEnd = termConfig.end;
        const termWeeks = analysisEnd - analysisStart + 1;
        const termFullTimeHp = this.fullTimeHpPerWeek * termWeeks;

        const loadChanges = new Map();
        let hasOverlap = false;

        courses.forEach(course => {
            const overlapStart = Math.max(course.startWeek, analysisStart);
            const overlapEnd = Math.min(course.endWeek, analysisEnd);
            if (overlapStart > overlapEnd) {
                return;
            }
            hasOverlap = true;
            const weeklyRate = course.hp / course.durationWeeks;
            loadChanges.set(overlapStart, (loadChanges.get(overlapStart) || 0) + weeklyRate);
            const endMarker = overlapEnd + 1;
            loadChanges.set(endMarker, (loadChanges.get(endMarker) || 0) - weeklyRate);
        });

        if (!hasOverlap) {
            overall.textContent = 'Genomsnitt: 0% - 0 hp';
            periods.innerHTML = '';
            periods.style.display = 'none';
            empty.style.display = 'block';
            empty.textContent = 'Kurserna ligger utanför den här terminen.';
            return;
        }

        loadChanges.set(analysisStart, (loadChanges.get(analysisStart) || 0));
        loadChanges.set(analysisEnd + 1, (loadChanges.get(analysisEnd + 1) || 0));

        const sortedWeeks = Array.from(loadChanges.keys())
            .filter(week => week >= analysisStart && week <= analysisEnd + 1)
            .sort((a, b) => a - b);

        let currentLoad = 0;
        const segments = [];

        for (let i = 0; i < sortedWeeks.length - 1; i++) {
            const week = sortedWeeks[i];
            currentLoad += loadChanges.get(week) || 0;
            const nextWeek = sortedWeeks[i + 1];
            const segmentStart = week;
            const segmentEnd = Math.min(nextWeek - 1, analysisEnd);
            if (segmentEnd < segmentStart) {
                continue;
            }
            const weeksInSegment = segmentEnd - segmentStart + 1;
            if (weeksInSegment <= 0) {
                continue;
            }
            const totalHp = currentLoad * weeksInSegment;
            const fullTimeHp = this.fullTimeHpPerWeek * weeksInSegment;
            const percentRaw = fullTimeHp > 0 ? (totalHp / fullTimeHp) * 100 : 0;
            const percent = Math.round(percentRaw * 10) / 10;
            const totalHpRounded = Math.round(totalHp * 10) / 10;
            const fullTimeHpRounded = Math.round(fullTimeHp * 10) / 10;
            const weeklyLoadRounded = Math.round(currentLoad * 100) / 100;
            segments.push({
                startWeek: segmentStart,
                endWeek: segmentEnd,
                weeks: weeksInSegment,
                percent,
                totalHp: totalHpRounded,
                fullTimeHp: fullTimeHpRounded,
                weeklyLoad: weeklyLoadRounded
            });
        }

        const totalHpInTerm = segments.reduce((sum, segment) => sum + segment.totalHp, 0);
        const avgPercentRaw = termFullTimeHp > 0 ? (totalHpInTerm / termFullTimeHp) * 100 : 0;
        const avgPercent = Math.round(avgPercentRaw * 10) / 10;

        overall.textContent = `Genomsnitt: ${this.formatNumber(avgPercent)}% - ${this.formatNumber(totalHpInTerm)} hp`;

        periods.innerHTML = '';
        periods.style.display = 'flex';
        empty.style.display = 'none';

        segments.forEach(segment => {
            if (Math.abs(segment.totalHp) < 0.001) {
                return;
            }

            const row = document.createElement('div');
            row.className = 'studietakt-summary-row';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'baseline';
            row.style.gap = '12px';

            const label = document.createElement('span');
            label.style.fontSize = '13px';
            label.style.color = '#333';
            label.textContent = `${this.formatWeekRange(segment.startWeek, segment.endWeek)} (${segment.weeks} v)`;

            const value = document.createElement('span');
            value.style.fontSize = '13px';
            value.style.color = '#333';
            value.textContent = `${this.formatNumber(segment.percent)}% - ${this.formatNumber(segment.weeklyLoad, 2)} hp/v (${this.formatNumber(segment.totalHp)} av ${this.formatNumber(segment.fullTimeHp)} hp)`;

            row.appendChild(label);
            row.appendChild(value);
            periods.appendChild(row);
        });

        if (!periods.hasChildNodes()) {
            periods.style.display = 'none';
            empty.style.display = 'block';
            empty.textContent = 'Ingen studietakt inom den här terminen.';
        }
    }

    formatWeekRange(startWeek, endWeek) {
        if (startWeek === endWeek) {
            return `v.${startWeek}`;
        }
        return `v.${startWeek}-${endWeek}`;
    }

    formatNumber(value, decimals = 1) {
        const factor = Math.pow(10, decimals);
        const rounded = Math.round(value * factor) / factor;
        if (Math.abs(rounded - Math.round(rounded)) < 0.5 / factor) {
            return Math.round(rounded).toString();
        }
        return rounded.toFixed(decimals);
    }

    findCourseElement(element) {
        // Try to find the course container by walking up the DOM
        let current = element;
        while (current && !current.classList.contains('course-container')) {
            current = current.parentElement;
        }
        
        if (!current) {
            // If we didn't find by class, try finding by structure
            current = element;
            while (current && !current.querySelector('.headline4')) {
                current = current.parentElement;
            }
        }

        return current;
    }

    initializeObserver() {
        console.log('Initializing observer');
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // Look for any toggle selection buttons
                            const buttons = node.querySelectorAll('button.toggleselection[data-id], button.button-component.toggleselection');
                            
                            buttons.forEach(button => {
                                if (!button.hasAttribute('data-timeline-initialized')) {
                                    button.setAttribute('data-timeline-initialized', 'true');
                                    button.addEventListener('click', this.handleToggleSelection.bind(this));
                                }
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleToggleSelection(e) {
        console.log('Button clicked:', e.currentTarget.id);
        const courseElement = this.findCourseElement(e.currentTarget);
        if (!courseElement) return;
        const courseId = e.currentTarget.getAttribute('data-id');
        const timelineItem = document.getElementById(`timeline-${courseId}`);
        const expandText = e.currentTarget.querySelector('.expand-text');
        if (timelineItem) {
            console.log('Removing course from timeline');
            const coursePoints = courseElement.querySelector('.universal_medium').textContent.split(',')[0].trim().replace(/[^\d.]/g, '');
            const hpValue = parseFloat(coursePoints);
            const { term, year } = this.extractTermInfo(courseElement);
            if (term && year) {
                const termKey = `${term}${year}`;
                this.removeCourseSchedule(termKey, courseId);
                const updatedHp = Math.max(0, (this.totalHPByTerm[termKey] || 0) - hpValue);
                this.updateTotalHP(updatedHp, termKey);
                this.updateStudietaktSummary(termKey);
            } else {
                console.error('Missing term information when removing course');
            }
            timelineItem.remove();
            if (expandText) {
                expandText.textContent = 'Lägg till';
            }
        } else {
            console.log('Adding course to timeline');
            this.addCourseToTimeline(courseElement);
            if (expandText) {
                expandText.textContent = 'Ta bort';
            }
        }
    }

    attachButtonListeners() {
        const buttons = document.querySelectorAll('button.toggleselection[data-id], button.button-component.toggleselection');
        buttons.forEach(button => {
            if (!button.hasAttribute('data-timeline-initialized')) {
                button.setAttribute('data-timeline-initialized', 'true');
                button.addEventListener('click', this.handleToggleSelection.bind(this));
            }
        });
    }
}

function initializeTimeline() {
    console.log('Initializing timeline script');
    
    // Initialize timeline first
    const timeline = new CourseTimeline();
    
    // Initialize observer
    timeline.initializeObserver();
    // Attach event listeners to pre-existing buttons
    timeline.attachButtonListeners();

    // Add initial courses that are already selected on the page
    const addedButtons = document.querySelectorAll('.searchresultcard button.toggleselection[data-id], .course-container button.toggleselection[data-id]');
    console.log('Found initially selected courses:', addedButtons.length);
    
    addedButtons.forEach(button => {
        // Check if the button shows "Ta bort" (Remove) text
        const contractText = button.querySelector('.contract-text:not(.hide)');
        if (contractText && contractText.textContent.includes('Ta bort')) {
            const courseElement = button.closest('.searchresultcard') || button.closest('.course-container');
            if (courseElement) {
                console.log('Adding initial course:', button.getAttribute('data-id'));
                timeline.addCourseToTimeline(courseElement);
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimeline);
} else {
    initializeTimeline();
}
