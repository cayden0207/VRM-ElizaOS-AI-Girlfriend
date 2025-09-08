/**
 * ElizaOS AI Girlfriend Chat System V3.0
 * Full integration with ElizaOS AgentRuntime
 * Includes memory, context, and relationship progression system
 */

class ElizaOSChatSystem {
    constructor() {
        this.apiBaseURL = this.getAPIBaseURL();
        this.currentUser = null;
        this.currentCharacter = null;
        this.chatHistory = [];
        this.relationshipData = null;
        this.isLoading = false;
        this.conversationContext = [];
        
        // ElizaOS specific indicators
        this.memoryIndicator = null;
        this.relationshipIndicator = null;
        
        // 🎵 Voice storage
        this.voiceStorage = new Map();
        
        this.initializeSystem();
    }
    
    getAPIBaseURL() {
        // Local development environment
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        
        // Production: use same origin
        return window.location.origin;
    }
    
    async initializeSystem() {
        console.log('🤖 ' + (window.i18n ? window.i18n.t('eliza.initializing') : 'Initializing ElizaOS chat system...'));
        
        try {
            // Check ElizaOS API health
            await this.checkElizaOSHealth();
            
            // Initialize auth
            await this.initializeAuth();
            
            // Setup UI
            this.setupElizaOSUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('✅ ' + (window.i18n ? window.i18n.t('eliza.init.complete') : 'ElizaOS chat system initialized'));
        } catch (error) {
            console.error('❌ ' + (window.i18n ? window.i18n.t('eliza.init.failed') : 'ElizaOS initialization failed') + ':', error);
            // Silent fallback on initialization error
        }
    }
    
    async checkElizaOSHealth() {
        try {
            const response = await fetch(`${this.apiBaseURL}/api/health`);
            if (!response.ok) throw new Error(window.i18n ? window.i18n.t('eliza.connection.failed') : 'Failed to connect ElizaOS API');
            
            const data = await response.json();
            console.log('🔗 ' + (window.i18n ? window.i18n.t('eliza.connection.normal') : 'ElizaOS connected') + ':', data);
            
            // Show system status
            if (data.agents) {
                console.log(`🤖 Agents loaded: ${data.agents.loaded}, active: ${data.agents.active}`);
            }
            
            return true;
        } catch (error) {
            console.warn('⚠️ ElizaOS connection failed:', error);
            throw error;
        }
    }
    
    async initializeAuth() {
        // Check localStorage auth info
        const walletAddress = localStorage.getItem('wallet_address') || localStorage.getItem('walletAddress');
        const selectedCharacterData = localStorage.getItem('selectedCharacter');
        
        if (walletAddress) {
            (window.AppConfig?.debug?.log || console.log)('🔑 Restoring auth session:', walletAddress.slice(0, 8) + '...');
            
            try {
                // Authenticate/register user with backend
                const authResponse = await fetch(`${this.apiBaseURL}/api/auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletAddress })
                });
                
                const authData = await authResponse.json();
                
                if (authData.success) {
                    this.currentUser = {
                        id: walletAddress,
                        profile: authData.data.user,
                        isNew: authData.data.isNew
                    };
                    
                    (window.AppConfig?.debug?.info || console.log)('✅ User authentication successful');
                    
                    // Restore previously selected character
                    if (selectedCharacterData) {
                        const characterData = JSON.parse(selectedCharacterData);
                        await this.setCurrentCharacter(characterData);
                    }
                } else {
                    throw new Error(authData.error);
                }
                
            } catch (error) {
                console.error('❌ Authentication failed:', error);
                this.handleAuthFailure();
            }
        } else {
        (window.AppConfig?.debug?.log || console.log)('Waiting for user login...');
        }
    }
    
    setupElizaOSUI() {
        // Create ElizaOS-specific UI elements
        this.createMemoryIndicator();
        this.createRelationshipIndicator();
        this.createContextDisplay();
    }
    
    // createMemoryIndicator function removed
    
    createRelationshipIndicator() {
        const chatHeader = document.querySelector('.chat-header') || document.body;
        
        this.relationshipIndicator = document.createElement('div');
        this.relationshipIndicator.id = 'relationship-indicator';
        this.relationshipIndicator.className = 'relationship-indicator';
        this.relationshipIndicator.innerHTML = `
            <div class="relationship-status">
                <span class="hearts" id="relationship-hearts">💝</span>
                <span class="level-text">Intimacy: <span id="relationship-level">1</span>/10</span>
            </div>
        `;
        
        this.relationshipIndicator.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 192, 203, 0.2);
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 12px;
            margin-left: 10px;
        `;
        
        chatHeader.appendChild(this.relationshipIndicator);
    }
    
    createContextDisplay() {
        const chatContainer = document.getElementById('chat-window-messages') || document.body;
        
        this.contextDisplay = document.createElement('div');
        this.contextDisplay.id = 'context-display';
        this.contextDisplay.className = 'context-display';
        this.contextDisplay.style.cssText = `
            background: rgba(230, 230, 250, 0.8);
            border-left: 4px solid #9370DB;
            padding: 8px 12px;
            margin: 8px 0;
            border-radius: 8px;
            font-size: 12px;
            font-style: italic;
            color: #666;
            display: none;
        `;
        
        chatContainer.appendChild(this.contextDisplay);
    }
    
    async setCurrentCharacter(characterData) {
        this.currentCharacter = characterData;
        (window.AppConfig?.debug?.log || console.log)('🎯 Setting current character:', characterData.name);
        
        // Load conversation history
        if (this.currentUser) {
            await this.loadConversationHistory();
        }
        
        // Update UI
        this.updateCharacterUI();
        
        // ⚠️ Removed recursive callback to avoid infinite loop
        // Do not trigger callback again, it would call setCurrentCharacter repeatedly
        // if (window.setCurrentCharacterCallback) {
        //     window.setCurrentCharacterCallback(characterData);
        // }
    }
    
    async loadConversationHistory() {
        if (!this.currentUser || !this.currentCharacter) return;
        
        try {
            (window.AppConfig?.debug?.log || console.log)('📜 Loading conversation history...');
            this.showMemoryStatus('Loading memories...');
            
            const response = await fetch(
                `${this.apiBaseURL}/api/history/${this.currentUser.id}/${this.currentCharacter.id}?limit=20`
            );
            
            const data = await response.json();
            
            if (data.success && data.data) {
                // Set relationship data
                this.relationshipData = data.data.relationship;
                
                // Render historical messages
                const conversations = data.data.conversations.reverse();
                conversations.forEach(conv => {
                    const message = {
                        id: conv.id,
                        sender: conv.role === 'user' ? 'user' : 'ai',
                        content: conv.content,
                        timestamp: conv.created_at,
                        emotion: conv.metadata?.emotion || 'neutral'
                    };
                    
                    this.chatHistory.push(message);
                    this.updateChatUI(message, false); // false = do not animate
                });
                
                // Update relationship indicator
                this.updateRelationshipUI();
                
                // Show context info
                if (conversations.length > 0) {
                    this.showContextInfo('Loaded ' + conversations.length + ' conversation memories');
                }
                
                (window.AppConfig?.debug?.log || console.log)(`✅ Loaded ${conversations.length} conversation history items`);
            }
            
            this.showMemoryStatus('Memory system ready');
            
        } catch (error) {
            console.error('❌ Load conversation history failed:', error);
            this.showMemoryStatus('Memory load failed');
        }
    }
    
    updateCharacterUI() {
        if (!this.currentCharacter) return;
        
        // Update character name
        const characterNameElement = document.getElementById('character-name');
        if (characterNameElement) {
            characterNameElement.textContent = this.currentCharacter.name;
        }
        
        // Update avatar
        const avatarElement = document.getElementById('character-avatar');
        if (avatarElement) {
            avatarElement.src = `characters/${this.currentCharacter.id}.jpg`;
        }
    }
    
    updateRelationshipUI() {
        if (!this.relationshipData) return;
        
        const level = this.relationshipData.relationship_level || 1;
        const levelElement = document.getElementById('relationship-level');
        const heartsElement = document.getElementById('relationship-hearts');
        
        if (levelElement) {
            levelElement.textContent = level;
        }
        
        if (heartsElement) {
            // Display hearts based on intimacy level
            const hearts = '💝'.repeat(Math.min(level, 5));
            heartsElement.textContent = hearts;
        }
    }
    
    showMemoryStatus(status) {
        if (this.memoryIndicator) {
            const textElement = this.memoryIndicator.querySelector('.memory-text');
            if (textElement) {
                textElement.textContent = status;
            }
        }
    }
    
    showContextInfo(info) {
        if (this.contextDisplay) {
            this.contextDisplay.textContent = `💭 ${info}`;
            this.contextDisplay.style.display = 'block';
            
            // Auto hide after 3 seconds
            setTimeout(() => {
                this.contextDisplay.style.display = 'none';
            }, 3000);
        }
    }
    
    setupEventListeners() {
        // Send message
        const sendButton = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        
        if (sendButton) {
            sendButton.addEventListener('click', () => this.handleSendMessage());
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }
        
        // Global character-set listener to prevent recursion
        window.setCurrentCharacterCallback = (character) => {
            // Only set when character actually changes
            if (!this.currentCharacter || 
                (this.currentCharacter.id || this.currentCharacter.name?.toLowerCase()) !== 
                (character.id || character.name?.toLowerCase())) {
                (window.AppConfig?.debug?.log || console.log)('External setCharacter request:', character.name);
                this.setCurrentCharacter(character);
            } else {
                (window.AppConfig?.debug?.log || console.log)('Skip duplicate setCharacter:', character.name);
            }
        };
    }
    
    async handleSendMessage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (!message || this.isLoading) return;
        
        if (!this.currentUser || !this.currentCharacter) {
            this.showError('Please log in and select a character first');
            return;
        }
        
        try {
            this.isLoading = true;
            messageInput.value = '';
            
            // Show user message
            const userMessage = {
                id: Date.now(),
                sender: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };
            
            this.chatHistory.push(userMessage);
            this.updateChatUI(userMessage);
            
            // Show memory status
            this.showMemoryStatus(window.i18n ? window.i18n.t('eliza.thinking') : 'AI is thinking...');
            this.showTypingIndicator();
            
            // Send to ElizaOS backend
            const requestData = {
                userId: this.currentUser.id,
                characterId: this.currentCharacter.id.toLowerCase(),
                message: message
            };
            
            (window.AppConfig?.debug?.log || console.log)('Send to ElizaOS:', requestData);
            
            const response = await fetch(`${this.apiBaseURL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            (window.AppConfig?.debug?.log || console.log)('HTTP status:', response.status, response.statusText);
            
            const data = await response.json();
            (window.AppConfig?.debug?.log || console.log)('ElizaOS response received');
            
            if (data.success && data.data) {
                (window.AppConfig?.debug?.log || console.log)('Prepare to display AI reply');
                // Add AI reply message
                const aiMessage = {
                    id: Date.now() + 1,
                    sender: 'ai',
                    content: data.data.response,
                    timestamp: new Date().toISOString(),
                    emotion: data.data.emotion || 'neutral',
                    relationshipLevel: data.data.relationship_level || 1
                };
                
                (window.AppConfig?.debug?.log || console.log)('AI message object prepared');
                this.chatHistory.push(aiMessage);
                
                // Update relationship data
                if (data.data.relationship_level) {
                    this.relationshipData = {
                        ...this.relationshipData,
                        relationship_level: data.data.relationship_level
                    };
                    this.updateRelationshipUI();
                }
                
                // Delay before displaying reply
                (window.AppConfig?.debug?.log || console.log)('AI reply will display in 1s...');
                setTimeout(() => {
                    (window.AppConfig?.debug?.log || console.log)('Start displaying AI reply...');
                    this.hideTypingIndicator();
                    this.updateChatUI(aiMessage);
                    
                    // 🎤 Store voice data and auto play
                    if (aiMessage.audio && aiMessage.audio.data) {
                        this.voiceStorage.set(aiMessage.id, aiMessage.audio);
                        (window.AppConfig?.debug?.log || console.log)('Auto-playing voice...');
                        this.playVoiceMessage(aiMessage.audio);
                    }
                    
                    // Trigger VRM expression and voice
                    this.triggerVRMResponse(aiMessage);
                    
                    this.showMemoryStatus('Memory updated');
                    
                    // Show relationship changes
                    if (data.data.relationship_level > (this.relationshipData?.relationship_level || 1)) {
                        this.showContextInfo(`Relationship level increased to ${data.data.relationship_level}!`);
                    }
                    
                }, 1000 + Math.random() * 2000);
                
            } else {
                console.error('❌ ElizaOS response format error:', data);
                console.error('❌ Detail:', {
                    success: data.success,
                    hasData: !!data.data,
                    dataKeys: data.data ? Object.keys(data.data) : null,
                    error: data.error
                });
                throw new Error(data.error || 'Send failed');
            }
            
        } catch (error) {
            console.error('❌ Message send failed:', error);
            this.hideTypingIndicator();
            this.showError('Send message failed: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }
    
    updateChatUI(message, animate = true) {
        (window.AppConfig?.debug?.log || console.log)('updateChatUI called with', {
            sender: message.sender,
            content: message.content,
            animate: animate
        });
        
        const messagesContainer = document.getElementById('chat-window-messages');
        if (!messagesContainer) {
            console.error('❌ chat-window-messages container not found');
            return;
        }
        
        (window.AppConfig?.debug?.log || console.log)('Messages container found');
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender}-message`;
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessage(message.content)}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
                ${message.relationshipLevel ? 
                  `<div class="relationship-hint">Intimacy: ${message.relationshipLevel}</div>` : ''}
            </div>
        `;
        
        if (animate) {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
        }
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (animate) {
            requestAnimationFrame(() => {
                messageElement.style.transition = 'all 0.3s ease';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            });
        }
    }
    
    triggerVRMResponse(message) {
        // Integrate with VRM system
        if (window.triggerExpression) {
            window.triggerExpression(message.emotion || 'neutral');
        }
        
        if (window.speakText && message.content) {
            window.speakText(message.content, this.currentCharacter?.voiceId);
        }
        
        (window.AppConfig?.debug?.log || console.log)('Trigger expression:', message.emotion);
    }
    
    showTypingIndicator() {
        const indicator = document.getElementById('typing-indicator') || this.createTypingIndicator();
        if (indicator) {
            indicator.style.display = 'flex';
        }
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    createTypingIndicator() {
        const messagesContainer = document.getElementById('chat-window-messages');
        if (!messagesContainer) return null;
        
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
            <div class="typing-text">${this.currentCharacter?.name || 'AI'} is typing...</div>
        `;
        indicator.style.display = 'none';
        
        messagesContainer.appendChild(indicator);
        return indicator;
    }
    
    formatMessage(content) {
        // Format message, support emoji and links
        return content
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    getEmotionEmoji(emotion) {
        const emotionMap = {
            happy: '😊',
            sad: '😢',
            angry: '😠',
            love: '😍',
            excited: '🤩',
            neutral: '😌'
        };
        return emotionMap[emotion] || '😌';
    }
    
    showError(message) {
        console.error('🚨', message);
        
        // Show error toast
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff6b6b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 3000);
    }
    
    handleAuthFailure() {
        // Authentication failure handling
        this.currentUser = null;
        this.currentCharacter = null;
        this.showError('Authentication failed, please reconnect wallet');
        
        // Clear storage
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('selectedCharacter');
    }
    
    // 🔗 Compatibility methods: keep old frontend working
    setCharacter(character) {
        // 🔍 Trace call stack to find repeated callers
        const stack = new Error().stack;
        const caller = stack.split('\n')[2]?.trim() || 'unknown';
        (window.AppConfig?.debug?.log || console.log)('Compat call: setCharacter ->', character.name, 'caller:', caller);
        
        // Improved duplicate-prevention via JSON compare
        if (this.currentCharacter) {
            const currentId = this.currentCharacter.id || this.currentCharacter.name?.toLowerCase();
            const newId = character.id || character.name?.toLowerCase();
            
            if (currentId === newId) {
                (window.AppConfig?.debug?.log || console.log)('Character already set; skip duplicate');
                return Promise.resolve(); // keep promise interface
            }
        }
        
        // 🚫 Debounce to prevent frequent calls
        if (this._setCharacterTimeout) {
            clearTimeout(this._setCharacterTimeout);
        }
        
        this._setCharacterTimeout = setTimeout(() => {
            (window.AppConfig?.debug?.log || console.log)('Applying character:', character.name);
            this.setCurrentCharacter(character);
            this._setCharacterTimeout = null;
        }, 100); // 100ms debounce
        
        return Promise.resolve();
    }
    
    async sendMessage(message) {
        (window.AppConfig?.debug?.log || console.log)('Compat call: sendMessage ->', message);
        
        if (!this.currentUser || !this.currentCharacter) {
            (window.AppConfig?.debug?.warn || console.warn)('User or character not set; cannot send');
            return;
        }
        
        try {
            // Get current UI language
            const currentLanguage = window.i18n ? window.i18n.getCurrentLanguage() : 'en';
            
            // Call ElizaOS chat API
            const response = await fetch(`${this.apiBaseURL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    characterId: this.currentCharacter.id,
                    message: message,
                    language: currentLanguage // pass language to backend
                })
            });
            
            if (!response.ok) {
                throw new Error(`Chat API error: ${response.status}`);
            }
            
            const data = await response.json();
            (window.AppConfig?.debug?.log || console.log)('Compat ElizaOS response received');
            
            if (data.success && data.data) {
                // Create user message
                const userMessage = {
                    id: Date.now(),
                    sender: 'user',
                    content: message,
                    timestamp: new Date()
                };
                
                // Create AI reply message
                const aiMessage = {
                    id: Date.now() + 1,
                    sender: 'ai',
                    content: data.data.response,
                    timestamp: new Date(),
                    emotion: data.data.emotion,
                    audio: data.data.audio // 🎤 attach voice data
                };
                
                (window.AppConfig?.debug?.log || console.log)('Prepare UI messages');
                
                // Update chat UI
                this.updateChatUI(userMessage);
                (window.AppConfig?.debug?.log || console.log)('User message UI updated');
                
                this.updateChatUI(aiMessage);
                (window.AppConfig?.debug?.log || console.log)('AI message UI updated');
                
                // 🎤 store voice and auto play
                if (aiMessage.audio && aiMessage.audio.data) {
                    this.voiceStorage.set(aiMessage.id, aiMessage.audio);
                    (window.AppConfig?.debug?.log || console.log)('Auto-playing voice...');
                    this.playVoiceMessage(aiMessage.audio);
                }
                
                (window.AppConfig?.debug?.log || console.log)('ElizaOS message sent');
                return data.data;
            } else {
                throw new Error(data.error || 'Send message failed');
            }
        } catch (error) {
            console.error('❌ Compat sendMessage error:', error);
            this.showError(`Send message failed: ${error.message}`);
        }
    }
    
    async getUserStats() {
        (window.AppConfig?.debug?.log || console.log)('Compat call: getUserStats');
        // Return basic stats
        return {
            totalInteractions: this.chatHistory.length,
            lastInteraction: Date.now()
        };
    }
    
    // waitingForWallet property compatibility
    get waitingForWallet() {
        return !this.currentUser;
    }
    
    set waitingForWallet(value) {
        // Compatibility setter; no-op
        (window.AppConfig?.debug?.log || console.log)('Compat set: waitingForWallet =', value);
    }
    
    // 🎤 Voice playback functions
    playVoiceMessage(audioData) {
        try {
            (window.AppConfig?.debug?.log || console.log)('Start playing voice...', {
                mimeType: audioData.mimeType,
                dataLength: audioData.data.length,
                voiceId: audioData.voiceId
            });
            
            this.tryPlayAudio(audioData);
            
        } catch (error) {
            console.error('❌ Voice processing failed:', error);
        }
    }
    
    // 🎤 Try multiple playback methods
    async tryPlayAudio(audioData) {
        const uint8Array = new Uint8Array(audioData.data);
        
        // Method 1: Blob URL (original approach)
        try {
            (window.AppConfig?.debug?.log || console.log)('Try method 1: Blob URL');
            const arrayBuffer = uint8Array.buffer;
            const blob = new Blob([arrayBuffer], { type: audioData.mimeType });
            const audioUrl = URL.createObjectURL(blob);
            
            const audio = new Audio();
            audio.volume = 0.8;
            
            // Set callbacks
            audio.onplay = () => {
                (window.AppConfig?.debug?.log || console.log)('Voice started (Blob URL)');
                this.showVoiceStatus('🎵 Playing...');
            };
            
            audio.onended = () => {
                (window.AppConfig?.debug?.log || console.log)('Voice finished');
                this.hideVoiceStatus();
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (error) => {
                (window.AppConfig?.debug?.warn || console.warn)('Blob URL method failed, try fallback:', error);
                URL.revokeObjectURL(audioUrl);
                this.tryPlayAudioFallback(audioData);
            };
            
            audio.src = audioUrl;
            await audio.play();
            return;
            
        } catch (blobError) {
            (window.AppConfig?.debug?.warn || console.warn)('Blob URL method failed, try fallback:', blobError);
            this.tryPlayAudioFallback(audioData);
        }
    }
    
    // 🎤 Fallback playback method
    tryPlayAudioFallback(audioData) {
        try {
            (window.AppConfig?.debug?.log || console.log)('Try method 2: Data URL');
            
            // Method 2: Data URL
            const uint8Array = new Uint8Array(audioData.data);
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
            }
            
            const base64 = btoa(binaryString);
            const dataUrl = `data:${audioData.mimeType};base64,${base64}`;
            
            const audio = new Audio();
            audio.volume = 0.8;
            
            audio.onplay = () => {
                (window.AppConfig?.debug?.log || console.log)('Voice started (Data URL)');
                this.showVoiceStatus('🎵 Playing...');
            };
            
            audio.onended = () => {
                (window.AppConfig?.debug?.log || console.log)('Voice finished');
                this.hideVoiceStatus();
            };
            
            audio.onerror = (error) => {
                console.error('❌ Data URL method also failed:', error);
                this.showVoiceStatus('❌ Voice playback failed');
                setTimeout(() => this.hideVoiceStatus(), 3000);
            };
            
            audio.src = dataUrl;
            audio.play().catch(error => {
                console.error('❌ Data URL playback start failed:', error);
                this.showVoiceStatus('❌ Voice playback failed');
                setTimeout(() => this.hideVoiceStatus(), 3000);
            });
            
        } catch (fallbackError) {
            console.error('❌ All voice playback methods failed:', fallbackError);
            // 创建用户交互播放按钮
            this.showInteractivePlayButton(audioData);
        }
    }
    
    // 🎤 Show interactive play button
    showInteractivePlayButton(audioData) {
        (window.AppConfig?.debug?.log || console.log)('Show user-interaction play button');
        
        // Create play button
        let playButton = document.getElementById('interactive-voice-play');
        if (!playButton) {
            playButton = document.createElement('button');
            playButton.id = 'interactive-voice-play';
            playButton.innerHTML = '🎵 Click to play voice';
            playButton.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
                animation: pulse 2s infinite;
            `;
            
            // 添加CSS动画
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
                #interactive-voice-play:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(playButton);
        }
        
        // Update button handler
        playButton.onclick = () => {
            (window.AppConfig?.debug?.log || console.log)('User clicked play voice');
            this.forcePlayAudio(audioData);
            playButton.remove();
        };
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            if (playButton && playButton.parentNode) {
                playButton.remove();
            }
        }, 10000);
    }
    
    // 🎤 Force play (needs user interaction)
    forcePlayAudio(audioData) {
        try {
            (window.AppConfig?.debug?.log || console.log)('Force play audio (user interaction)');
            
            // Use simplest approach to play
            const uint8Array = new Uint8Array(audioData.data);
            const arrayBuffer = uint8Array.buffer;
            const blob = new Blob([arrayBuffer], { type: audioData.mimeType });
            
            // Create temp URL
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.volume = 0.8;
            
            audio.onplay = () => {
                (window.AppConfig?.debug?.log || console.log)('User-interaction voice playback success');
                this.showVoiceStatus('🎵 Playing...');
            };
            
            audio.onended = () => {
                (window.AppConfig?.debug?.log || console.log)('Voice playback finished');
                this.hideVoiceStatus();
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (error) => {
                console.error('❌ User-interaction playback also failed:', error);
                URL.revokeObjectURL(audioUrl);
                this.showVoiceStatus('❌ Voice playback failed');
                setTimeout(() => this.hideVoiceStatus(), 3000);
            };
            
            // As it's user-interaction triggered, should succeed
            audio.play();
            
        } catch (error) {
            console.error('❌ Force play failed:', error);
            this.showVoiceStatus('❌ 语音播放失败');
            setTimeout(() => this.hideVoiceStatus(), 3000);
        }
    }
    
    // 显示语音状态
    showVoiceStatus(message) {
        // 创建或更新语音状态显示
        let voiceStatus = document.getElementById('voice-status');
        if (!voiceStatus) {
            voiceStatus = document.createElement('div');
            voiceStatus.id = 'voice-status';
            voiceStatus.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(147, 112, 219, 0.9);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 1000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                animation: fadeIn 0.3s ease;
            `;
            document.body.appendChild(voiceStatus);
        }
        voiceStatus.textContent = message;
        voiceStatus.style.display = 'block';
    }
    
    // 隐藏语音状态
    hideVoiceStatus() {
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.style.display = 'none';
        }
    }
}

// 创建全局实例
window.ElizaOSChatSystem = ElizaOSChatSystem;

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    if (!window.elizaChatSystem) {
        window.elizaChatSystem = new ElizaOSChatSystem();
        
        // 🔗 兼容性别名：让旧的前端代码可以访问ElizaOS系统
        window.chatSystemV2 = window.elizaChatSystem;
        (window.AppConfig?.debug?.log || console.log)('Set compatibility alias: window.chatSystemV2 -> ElizaOS');
    }
});

// 导出类
export default ElizaOSChatSystem;
