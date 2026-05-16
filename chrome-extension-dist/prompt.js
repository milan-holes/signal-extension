const fs = require('fs');

const cssCode = `
        #signal-replay-widget {
          position: fixed;
          top: 16px;
          right: 16px;
          width: 360px;
          max-height: 75vh;
          background: #111418;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-size: 13px;
          color: #f0f6fc;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(24px) saturate(150%);
          -webkit-backdrop-filter: blur(24px) saturate(150%);
          animation: sr-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: default;
          user-select: none;
        }

        @keyframes sr-slide-in {
          from { opacity: 0; transform: translateY(-16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        #signal-replay-widget .sr-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          cursor: grab;
        }

        #signal-replay-widget .sr-header:active { cursor: grabbing; }

        #signal-replay-widget .sr-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          font-size: 14px;
          color: #ffffff;
          letter-spacing: -0.01em;
        }

        #signal-replay-widget .sr-title svg {
          color: #58a6ff;
          filter: drop-shadow(0 0 8px rgba(88, 166, 255, 0.4));
        }

        #signal-replay-widget .sr-counter {
          font-size: 12px;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.1);
          padding: 3px 10px;
          border-radius: 12px;
          color: #8b949e;
          margin-left: 4px;
        }

        #signal-replay-widget .sr-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        #signal-replay-widget .sr-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: #c9d1d9;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        #signal-replay-widget .sr-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        #signal-replay-widget .sr-btn:active {
          transform: translateY(0);
        }

        #signal-replay-widget .sr-pause-btn.paused {
          background: rgba(88, 166, 255, 0.15);
          color: #58a6ff;
          border-color: rgba(88, 166, 255, 0.3);
          box-shadow: 0 0 12px rgba(88, 166, 255, 0.2);
        }

        #signal-replay-widget .sr-close-btn {
          padding: 6px;
        }

        #signal-replay-widget .sr-close-btn:hover {
          background: rgba(248, 81, 73, 0.15);
          color: #f85149;
          border-color: rgba(248, 81, 73, 0.3);
        }

        #signal-replay-widget .sr-remove-btn {
          display: none;
          background: none;
          border: none;
          color: #484f58;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          font-size: 16px;
          line-height: 1;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        #signal-replay-widget .sr-remove-btn:hover {
          color: #f85149;
          background: rgba(248, 81, 73, 0.1);
        }

        #signal-replay-widget.sr-ready-mode .sr-remove-btn {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #signal-replay-widget .sr-inspect-btn,
        #signal-replay-widget .sr-copy-btn {
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          font-size: 14px;
          flex-shrink: 0;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.6;
        }

        #signal-replay-widget .sr-event-row:hover .sr-inspect-btn,
        #signal-replay-widget .sr-event-row:hover .sr-copy-btn {
          opacity: 1;
        }

        #signal-replay-widget .sr-inspect-btn:hover,
        #signal-replay-widget .sr-copy-btn:hover {
          color: #58a6ff;
          background: rgba(88, 166, 255, 0.1);
        }

        #signal-replay-widget .sr-start-bar {
          padding: 16px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
          text-align: center;
          display: flex;
          justify-content: center;
        }

        #signal-replay-widget .sr-start-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 28px;
          border: 1px solid rgba(46, 160, 67, 0.4);
          border-radius: 8px;
          background: linear-gradient(180deg, #2ea043 0%, #238636 100%);
          color: #ffffff;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 12px rgba(46, 160, 67, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          width: 100%;
        }

        #signal-replay-widget .sr-start-btn:hover {
          background: linear-gradient(180deg, #3fb950 0%, #2ea043 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(46, 160, 67, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
          border-color: rgba(46, 160, 67, 0.6);
        }
        
        #signal-replay-widget .sr-start-btn:active {
           transform: translateY(0);
           box-shadow: 0 2px 6px rgba(46, 160, 67, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }

        #signal-replay-widget .sr-restart-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 18px;
          border: 1px solid rgba(210, 153, 34, 0.4);
          border-radius: 8px;
          background: rgba(210, 153, 34, 0.15);
          color: #e3b341;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s ease;
          margin-top: 12px;
          box-shadow: 0 2px 8px rgba(210, 153, 34, 0.1);
        }

        #signal-replay-widget .sr-restart-btn:hover {
          background: rgba(210, 153, 34, 0.25);
          color: #f0c75e;
          border-color: rgba(210, 153, 34, 0.6);
          transform: translateY(-1px);
        }

        #signal-replay-widget .sr-progress-bar {
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        #signal-replay-widget .sr-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #1f6feb 0%, #58a6ff 100%);
          transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 10px rgba(88, 166, 255, 0.5);
          position: relative;
        }
        
        #signal-replay-widget .sr-progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
           0% { transform: translateX(-100%); }
           100% { transform: translateX(100%); }
        }

        #signal-replay-widget .sr-event-list {
          flex: 1;
          overflow-y: auto;
          max-height: 45vh;
          padding: 8px 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }

        #signal-replay-widget .sr-event-list::-webkit-scrollbar { width: 6px; }
        #signal-replay-widget .sr-event-list::-webkit-scrollbar-track { background: transparent; }
        #signal-replay-widget .sr-event-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
        #signal-replay-widget .sr-event-list::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }

        #signal-replay-widget .sr-event-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          transition: all 0.2s ease;
          border-left: 3px solid transparent;
          position: relative;
        }

        #signal-replay-widget .sr-event-row::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 1px;
          background: rgba(255, 255, 255, 0.04);
        }
        
        #signal-replay-widget .sr-event-row:last-child::after {
          display: none;
        }

        #signal-replay-widget .sr-event-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        #signal-replay-widget .sr-event-row.active {
          background: linear-gradient(90deg, rgba(88, 166, 255, 0.1) 0%, rgba(88, 166, 255, 0) 100%);
          border-left-color: #58a6ff;
        }

        #signal-replay-widget .sr-event-row.done {
          opacity: 0.6;
        }

        #signal-replay-widget .sr-event-row.done .sr-event-status {
          color: #3fb950;
        }
        
        #signal-replay-widget .sr-event-row.done .sr-event-label {
          text-decoration: line-through;
          text-decoration-color: rgba(139, 148, 158, 0.5);
        }

        #signal-replay-widget .sr-event-row.error {
          opacity: 1;
          background: linear-gradient(90deg, rgba(248, 81, 73, 0.08) 0%, rgba(248, 81, 73, 0) 100%);
          border-left-color: #f85149;
        }

        #signal-replay-widget .sr-event-row.error .sr-event-status {
          color: #f85149;
        }

        #signal-replay-widget .sr-event-status {
          font-size: 14px;
          flex-shrink: 0;
          width: 20px;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #signal-replay-widget .sr-event-idx {
          color: #6e7681;
          font-size: 12px;
          min-width: 22px;
          font-variant-numeric: tabular-nums;
        }

        #signal-replay-widget .sr-event-type {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          flex-shrink: 0;
          letter-spacing: 0.5px;
        }

        #signal-replay-widget .sr-event-type.click {
          background: rgba(130, 80, 223, 0.15);
          color: #d2a8ff;
          border: 1px solid rgba(130, 80, 223, 0.3);
        }

        #signal-replay-widget .sr-event-type.input {
          background: rgba(210, 153, 34, 0.15);
          color: #e3b341;
          border: 1px solid rgba(210, 153, 34, 0.3);
        }

        #signal-replay-widget .sr-event-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #c9d1d9;
          font-size: 13px;
          line-height: 1.4;
        }

        #signal-replay-widget .sr-retry-btn {
          background: rgba(248, 81, 73, 0.1);
          border: 1px solid rgba(248, 81, 73, 0.4);
          color: #ff7b72;
          border-radius: 6px;
          cursor: pointer;
          padding: 4px 8px;
          font-size: 13px;
          font-family: inherit;
          transition: all 0.2s ease;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(248, 81, 73, 0.1);
        }

        #signal-replay-widget .sr-retry-btn:hover {
          background: rgba(248, 81, 73, 0.2);
          color: #ffa198;
          border-color: rgba(248, 81, 73, 0.6);
          transform: translateY(-1px);
        }

        #signal-replay-widget .sr-skip-failed-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: 1px solid rgba(210, 153, 34, 0.4);
          border-radius: 6px;
          background: rgba(210, 153, 34, 0.15);
          color: #e3b341;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        #signal-replay-widget .sr-skip-failed-btn:hover {
          background: rgba(210, 153, 34, 0.25);
          color: #f0c75e;
          border-color: rgba(210, 153, 34, 0.6);
        }

        #signal-replay-widget .sr-error-detail {
          font-size: 12px;
          margin: 6px 0;
          color: #ffa198;
          word-break: break-word;
          line-height: 1.4;
          background: rgba(248, 81, 73, 0.1);
          padding: 8px 12px;
          border-radius: 6px;
          border-left: 3px solid #f85149;
        }

        #signal-replay-widget .sr-footer {
          padding: 12px 18px;
          font-size: 12px;
          color: #8b949e;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
          background: rgba(0, 0, 0, 0.2);
        }

        #signal-replay-widget .sr-footer.success {
          color: #3fb950;
          font-weight: 500;
          background: linear-gradient(180deg, rgba(46, 160, 67, 0.05) 0%, rgba(46, 160, 67, 0.1) 100%);
        }

        #signal-replay-widget .sr-footer.has-errors {
          color: #f85149;
          background: linear-gradient(180deg, rgba(248, 81, 73, 0.05) 0%, rgba(248, 81, 73, 0.1) 100%);
        }

        #signal-replay-widget .sr-footer.cancelled {
          color: #d29922;
          font-weight: 500;
        }

        @keyframes sr-pulse-active {
          0%, 100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 4px rgba(88, 166, 255, 0.4)); }
          50% { opacity: 0.6; transform: scale(0.9); filter: drop-shadow(0 0 1px rgba(88, 166, 255, 0.1)); }
        }

        #signal-replay-widget .sr-event-row.active .sr-event-status {
          animation: sr-pulse-active 1.5s ease-in-out infinite;
          color: #58a6ff;
        }

        #signal-replay-widget .sr-event-row.countdown .sr-event-status {
          color: #d29922;
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          background: rgba(210, 153, 34, 0.15);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(210, 153, 34, 0.4);
        }

        #signal-replay-widget .sr-event-row.countdown {
          background: linear-gradient(90deg, rgba(210, 153, 34, 0.08) 0%, rgba(210, 153, 34, 0) 100%);
          border-left-color: #d29922;
        }

        #signal-replay-widget .sr-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.15);
        }

        #signal-replay-widget .sr-toolbar-label {
          font-size: 11px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        #signal-replay-widget .sr-delay-select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          color: #e6edf3;
          font-size: 12px;
          font-family: inherit;
          padding: 4px 8px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
        }

        #signal-replay-widget .sr-delay-select:hover,
        #signal-replay-widget .sr-delay-select:focus {
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
        }

        #signal-replay-widget .sr-delay-select option {
          background: #111418;
          color: #e6edf3;
        }

        #signal-replay-widget .sr-skip-btn,
        #signal-replay-widget .sr-cancel-btn {
          padding: 5px 10px;
          font-size: 11px;
          gap: 4px;
        }

        #signal-replay-widget .sr-skip-btn:hover {
          background: rgba(210, 153, 34, 0.15);
          color: #d29922;
          border-color: rgba(210, 153, 34, 0.3);
        }

        #signal-replay-widget .sr-cancel-btn:hover {
          background: rgba(248, 81, 73, 0.15);
          color: #f85149;
          border-color: rgba(248, 81, 73, 0.3);
        }

        #signal-replay-widget .sr-play-now-btn {
          display: none;
          background: rgba(88, 166, 255, 0.1);
          border: 1px solid rgba(88, 166, 255, 0.4);
          color: #58a6ff;
          border-radius: 6px;
          cursor: pointer;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          transition: all 0.2s ease;
          flex-shrink: 0;
          align-items: center;
          gap: 4px;
          box-shadow: 0 2px 6px rgba(88, 166, 255, 0.1);
        }

        #signal-replay-widget .sr-play-now-btn:hover {
          background: rgba(88, 166, 255, 0.2);
          color: #79c0ff;
          border-color: rgba(88, 166, 255, 0.6);
          transform: translateY(-1px);
        }

        #signal-replay-widget .sr-event-row.countdown .sr-play-now-btn {
          display: inline-flex;
        }

        @keyframes sr-highlight-pulse {
          0% { box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.6), inset 0 0 16px rgba(88, 166, 255, 0.2); border-color: #58a6ff; }
          50% { box-shadow: 0 0 24px 10px rgba(88, 166, 255, 0.3), inset 0 0 24px rgba(88, 166, 255, 0.15); border-color: #79c0ff; }
          100% { box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.6), inset 0 0 16px rgba(88, 166, 255, 0.2); border-color: #58a6ff; }
        }

        #signal-replay-highlight {
          position: absolute;
          border: 3px solid #58a6ff;
          border-radius: 6px;
          pointer-events: none;
          z-index: 2147483646;
          animation: sr-highlight-pulse 1.5s ease-in-out infinite;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(88, 166, 255, 0.05);
        }

        #signal-replay-highlight-label {
          position: absolute;
          background: #111418;
          color: #f0f6fc;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(88, 166, 255, 0.4);
          pointer-events: none;
          z-index: 2147483646;
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05) inset;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        #signal-replay-highlight-label .sr-hl-type {
          display: inline-flex;
          align-items: center;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        #signal-replay-highlight-label .sr-hl-type.click {
          background: rgba(130, 80, 223, 0.2);
          color: #d2a8ff;
          border: 1px solid rgba(130, 80, 223, 0.3);
        }

        #signal-replay-highlight-label .sr-hl-type.input {
          background: rgba(210, 153, 34, 0.2);
          color: #e3b341;
          border: 1px solid rgba(210, 153, 34, 0.3);
        }
`;

const fileContent = fs.readFileSync('/home/twd/dev/signal-extension/content.js', 'utf8');

const regex = /styleEl\.textContent\s*=\s*`[\s\S]*?`;/;

const newText = 'styleEl.textContent = `\n' + cssCode + '`;';

const updatedContent = fileContent.replace(regex, newText);

fs.writeFileSync('/home/twd/dev/signal-extension/content.js', updatedContent, 'utf8');
console.log('Replaced correctly!');
