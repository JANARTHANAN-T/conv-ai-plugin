(() => {
    const CDN_PATH_PREFIX = 'https://cdn.jsdelivr.net/gh/JANARTHANAN-T/conv-ai-plugin@main';

    const defaultTheme = {
        primaryColor: '#2A59F1',
        secondaryColor: '#FFFFFF',
        backgroundColor: '#EDF1FF',
        textColor: '#000000'
    };

    
    class ConvAIPlugin {
        constructor(options = {}) {
            this.options = {
                agentId: options.agentId ?? '',
                buttonPosition: options.buttonPosition ?? 'bottom-right',
                theme: {
                    ...defaultTheme,
                    ...(options.theme || {})
                }
            };
            this.wsURL = null;
            this.token = null;
            this.state = 'idle'; //idle, connecting, listening, thinking, speaking
            this.room = null;
            this.audioElement = null;

            this.embedLivekitCdn();
            this.injectStyles();
            this.createUI();
        }

        embedLivekitCdn() {
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js";
            script.onload = async () => {
                this.room = new LivekitClient.Room();
                this.room
                    .on(LivekitClient.RoomEvent.TrackSubscribed, this.handleTrackSubscribed.bind(this))
                    .on(LivekitClient.RoomEvent.TrackUnsubscribed, this.handleTrackUnsubscribed.bind(this))
                    .on(LivekitClient.RoomEvent.ActiveSpeakersChanged, this.handleActiveSpeakerChange.bind(this))
                    .on(LivekitClient.RoomEvent.Disconnected, this.handleDisconnect.bind(this))
                    .on(LivekitClient.RoomEvent.LocalTrackUnpublished, this.handleLocalTrackUnpublished.bind(this));
            };
            document.head.appendChild(script);
        }

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .conv-ai-voice-assistant-container {
                    position: fixed;
                    ${this._getPositionStyles()}
                    background: ${this.options.theme.backgroundColor};
                    border-radius: 24px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.23);
                    padding: 20px;
                    width: 220px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    font-family: sans-serif;
                    z-index: 9999;
                }
        
                .conv-ai-voice-assistant-button {
                    position: fixed;
                    ${this._getPositionStyles()}
                    background: ${this.options.theme.backgroundColor};
                    border-radius: 28px;
                    padding: 16px 8px 16px 16px;
                    cursor: pointer;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.23);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    column-gap: 8px;
                }
        
                .conv-ai-voice-assistant-button span {
                    max-width: 0;
                    opacity: 0;
                    padding-right: 0;
                    overflow: hidden;
                    white-space: nowrap;
                    transition: all 0.6s ease;
                }
        
                .conv-ai-voice-assistant-button:hover span {
                    max-width: 120px; 
                    padding-right: 8px;
                    opacity: 1;
                }
        
                .conv-ai-voice-assistant-avatar {
                    height: 80px;
                    margin-bottom: 12px;
                }
        
                .conv-ai-voice-assistant-message {
                    font-size: 14px;
                    color: #111827;
                    text-align: center;
                }
        
                .conv-ai-pill {
                    padding: 6px 16px;
                    border-radius: 9999px;
                    font-size: 16px;
                    border: none;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    column-gap: 8px;
                }
        
                .conv-ai-pill.conv-ai-red {
                    background-color: ${this.options.theme.secondaryColor};
                    color: #D83C3C;
                }
        
                .conv-ai-pill.conv-ai-white {
                    background-color: ${this.options.theme.secondaryColor};
                }
        
                .conv-ai-pill.conv-ai-primary {
                    background-color: ${this.options.theme.primaryColor};
                    color: #FFF;
                }
        
                .conv-ai-icon {
                    height: 24px;
                }
        
                .conv-ai-cursor-pointer {
                    cursor: pointer;
                }
        
                .conv-ai-message-box-wrapper {
                    display: flex;
                    align-items: center;
                    column-gap: 8px;
                }
            `;
            document.head.appendChild(style);
        }

        _getPositionStyles() {
            switch (this.options.buttonPosition) {
                case 'top-left' : return 'top: 20px; left: 20px;';
                case 'middle-left' : return 'top: 50%; transform: translateY(-50%); left: 20px;';
                case 'bottom-left' : return 'bottom: 20px; left: 20px;';
                case 'top-middle': return 'top: 20px; left: 50%; transform: translateX(-50%);';
                case 'center': return 'top: 50%; transform: translate(-50%, -50%); left: 50%;';
                case 'bottom-middle': return 'bottom: 20px; left: 50%; transform: translateX(-50%);';
                case 'top-right': return 'top: 20px; right: 20px;';
                case 'middle-right': return 'top: 50%; transform: translateY(-50%); right: 20px;';
                case 'bottom-right':
                default: return 'bottom: 20px; right: 20px;';
            }
        }

        createUI() {
            this.voiceAssistantButton = document.createElement('div');
            this.voiceAssistantButton.id = 'voice-assistant-button';
            this.voiceAssistantButton.className = 'conv-ai-voice-assistant-button';
            this.voiceAssistantButton.innerHTML = `<img src="${CDN_PATH_PREFIX}/phone-icon.png" class="conv-ai-icon" /> <span>Let's Talk</span>`;
            this.voiceAssistantButton.addEventListener('click', () => this.handleButtonClick());
            document.body.appendChild(this.voiceAssistantButton);

            this.container = document.createElement('div');
            this.container.id = 'voice-assistant-container';
            this.container.className = 'conv-ai-voice-assistant-container';
            this.container.style.display = 'none';
        
            this.avatar = document.createElement('img');
            this.avatar.src = `${CDN_PATH_PREFIX}/image.png`;
            this.avatar.className = 'conv-ai-voice-assistant-avatar';
            this.container.appendChild(this.avatar);
        
            this.messageBox = document.createElement('div');
            this.messageBox.className = 'conv-ai-voice-assistant-message';
            this.container.appendChild(this.messageBox);
        
            document.body.appendChild(this.container);
        }

        setState(newState) {
            this.state = newState;
            this.container.style.display = newState === 'idle' ? 'none' : 'flex';
            this.voiceAssistantButton.style.display = newState === 'idle' ? 'flex' : 'none';
            this.updateButtonState();
        }
    
        updateButtonState() {
            this.messageBox.innerHTML = '';
            const iconUrl = `${CDN_PATH_PREFIX}/circle-stop.png`;
            const stopBtn = `<button class="conv-ai-pill conv-ai-red conv-ai-cursor-pointer" id="disconnect-button"><img src="${iconUrl}" class="conv-ai-icon" /></button>`;
        
            const states = {
                connecting: '<button class="conv-ai-pill conv-ai-primary">Connecting...</button>',
                listening: `<div class="conv-ai-message-box-wrapper"><button class="conv-ai-pill conv-ai-primary">Listening...</button>${stopBtn}</div>`,
                thinking: `<div class="conv-ai-message-box-wrapper"><button class="conv-ai-pill conv-ai-white">Thinking...</button>${stopBtn}</div>`,
                speaking: `<button class="conv-ai-pill conv-ai-red conv-ai-cursor-pointer" id="disconnect-button"><img src="${iconUrl}" class="conv-ai-icon" /> Stop me</button>`
            };
        
            if (this.state in states) {
                this.messageBox.innerHTML = states[this.state];
            }
        
            const stopButton = this.messageBox.querySelector('#disconnect-button');
            if (stopButton) stopButton.addEventListener('click', () => this.handleButtonClick());
        }
    
        handleButtonClick() {
            if (this.state === 'idle') this.connect();
            else this.disconnect();
        }
    
        async connect() {
            if (!this.room) {
                console.error('Room not initialized. LiveKit SDK may not be loaded yet.');
                return;
            }

            try {
                this.setState('connecting');
                const livekit_token_details = await this.getLiveKitToken();
                this.wsURL = livekit_token_details.data.wsUrl;
                this.token = livekit_token_details.data.token;
                await this.room.connect(this.wsURL, this.token);
                await this.room.localParticipant.setMicrophoneEnabled(true);
                this.setState('listening');
            } catch (error) {
                this.handleError(error);
            }
        }

        handleError(error) {
            console.error('Conv AI Agent Error:', error);
            this.setState('idle');
            this.dispatchEvent('error', { error });
        }

        disconnect() {
            if (this.room) {
                this.room.localParticipant.setMicrophoneEnabled(false);
                this.room.disconnect();
            }
            if (this.audioElement) {
                this.audioElement.remove();
                this.audioElement = null;
            }
            this.setState('idle');
        }
    
        dispatchEvent(eventName, data) {
            const event = new CustomEvent(`voiceassistant:${eventName}`, { detail: data });
            document.dispatchEvent(event);
        }
    
        on(eventName, callback) {
            document.addEventListener(`voiceassistant:${eventName}`, callback);
        }
    
        off(eventName, callback) {
            document.removeEventListener(`voiceassistant:${eventName}`, callback);
        }
    
        destroy() {
            this.disconnect();
            this.container?.remove();
            this.voiceAssistantButton?.remove();
        }

        handleTrackSubscribed(track, publication, participant) {
            if (track.kind === LivekitClient.Track.Kind.Audio) {
                this.audioElement = track.attach(); // creates <audio> element
                document.body.appendChild(this.audioElement);
                this.setState('speaking');
            }
        }

        handleTrackUnsubscribed(track, publication, participant) {
            track.detach(); 
            if (this.audioElement) {
                this.audioElement.remove();
                this.audioElement = null;
            }
            this.setState('listening');
        }

        handleLocalTrackUnpublished(publication, participant) {
            if (publication.track) {
                publication.track.detach();
            }
        }
        
        handleActiveSpeakerChange(speakers) {
            speakers.forEach(speaker => {
                if(speaker.participantInfo.kind === 4) {
                    this.setState('speaking');
                } else if(speaker.participantInfo.kind === 0) {
                    this.setState('listening');  
                } 
            });
        }

        handleDisconnect() {
            this.setState('idle');
        }

        async getLiveKitToken() {
            try {
                const response = await fetch('https://conv-ai-frontend.dev.grootan.net/api/v1/agents/register', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        agent_id: this.options.agentId,
                        ttl_days: 1
                    })
                });

                if (!response.ok) {
                    this.disconnect(); 
                    throw new Error(`Request failed with status ${response.status}`);
                }

                const data = await response.json();
                return data;

            } catch (error) {
                console.error('Error fetching LiveKit token:', error);
                throw error; 
            }
        }

    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ConvAIPlugin;
    } else {
        window.ConvAIPlugin = ConvAIPlugin;
    }
})();
