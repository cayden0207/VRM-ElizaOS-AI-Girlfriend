/**
 * ElizaOS AI女友聊天系统 V3.0
 * 完整集成ElizaOS AgentRuntime
 * 具备记忆、上下文、关系进展系统
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
        
        // ElizaOS特有功能
        this.memoryIndicator = null;
        this.relationshipIndicator = null;
        
        // 🎵 语音存储系统
        this.voiceStorage = new Map();
        
        this.initializeSystem();
    }
    
    getAPIBaseURL() {
        // 如果是本地开发环境
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';
        }
        
        // 生产环境：直接使用当前域名（单体应用）
        return window.location.origin;
    }
    
    async initializeSystem() {
        console.log('🤖 ' + (window.i18n ? window.i18n.t('eliza.initializing') : '初始化ElizaOS聊天系统...'));
        
        try {
            // 检查ElizaOS API健康状态
            await this.checkElizaOSHealth();
            
            // 初始化用户认证
            await this.initializeAuth();
            
            // 设置UI组件
            this.setupElizaOSUI();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            console.log('✅ ' + (window.i18n ? window.i18n.t('eliza.init.complete') : 'ElizaOS聊天系统初始化完成'));
        } catch (error) {
            console.error('❌ ' + (window.i18n ? window.i18n.t('eliza.init.failed') : 'ElizaOS系统初始化失败') + ':', error);
            // 静默处理初始化失败，系统会自动使用后备模式
        }
    }
    
    async checkElizaOSHealth() {
        try {
            const response = await fetch(`${this.apiBaseURL}/api/health`);
            if (!response.ok) throw new Error(window.i18n ? window.i18n.t('eliza.connection.failed') : 'ElizaOS API连接失败');
            
            const data = await response.json();
            console.log('🔗 ' + (window.i18n ? window.i18n.t('eliza.connection.normal') : 'ElizaOS连接正常') + ':', data);
            
            // 显示系统状态
            if (data.agents) {
                console.log(`🤖 可用Agent: ${data.agents.loaded}, 活跃: ${data.agents.active}`);
            }
            
            return true;
        } catch (error) {
            console.warn('⚠️ ElizaOS连接失败:', error);
            throw error;
        }
    }
    
    async initializeAuth() {
        // 检查localStorage中的认证信息
        const walletAddress = localStorage.getItem('wallet_address') || localStorage.getItem('walletAddress');
        const selectedCharacterData = localStorage.getItem('selectedCharacter');
        
        if (walletAddress) {
            console.log('🔑 恢复认证会话:', walletAddress.slice(0, 8) + '...');
            
            try {
                // 向ElizaOS后端验证/注册用户
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
                    
                    console.log('✅ 用户认证成功');
                    
                    // 恢复角色选择
                    if (selectedCharacterData) {
                        const characterData = JSON.parse(selectedCharacterData);
                        await this.setCurrentCharacter(characterData);
                    }
                } else {
                    throw new Error(authData.error);
                }
                
            } catch (error) {
                console.error('❌ 认证失败:', error);
                this.handleAuthFailure();
            }
        } else {
            console.log('⏳ 等待用户登录...');
        }
    }
    
    setupElizaOSUI() {
        // 创建ElizaOS特有的UI元素
        this.createMemoryIndicator();
        this.createRelationshipIndicator();
        this.createContextDisplay();
    }
    
    // createMemoryIndicator 函数已移除
    
    createRelationshipIndicator() {
        const chatHeader = document.querySelector('.chat-header') || document.body;
        
        this.relationshipIndicator = document.createElement('div');
        this.relationshipIndicator.id = 'relationship-indicator';
        this.relationshipIndicator.className = 'relationship-indicator';
        this.relationshipIndicator.innerHTML = `
            <div class="relationship-status">
                <span class="hearts" id="relationship-hearts">💝</span>
                <span class="level-text">亲密度: <span id="relationship-level">1</span>/10</span>
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
        console.log('🎯 设置当前角色:', characterData.name);
        
        // 加载对话历史
        if (this.currentUser) {
            await this.loadConversationHistory();
        }
        
        // 更新UI
        this.updateCharacterUI();
        
        // ⚠️ 移除循环调用 - 避免无限循环
        // 不再触发callback，因为callback又会调用setCurrentCharacter形成循环
        // if (window.setCurrentCharacterCallback) {
        //     window.setCurrentCharacterCallback(characterData);
        // }
    }
    
    async loadConversationHistory() {
        if (!this.currentUser || !this.currentCharacter) return;
        
        try {
            console.log('📜 加载对话历史...');
            this.showMemoryStatus('加载记忆中...');
            
            const response = await fetch(
                `${this.apiBaseURL}/api/history/${this.currentUser.id}/${this.currentCharacter.id}?limit=20`
            );
            
            const data = await response.json();
            
            if (data.success && data.data) {
                // 设置关系数据
                this.relationshipData = data.data.relationship;
                
                // 显示历史对话
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
                    this.updateChatUI(message, false); // false = 不触发动画
                });
                
                // 更新关系指示器
                this.updateRelationshipUI();
                
                // 显示上下文信息
                if (conversations.length > 0) {
                    this.showContextInfo('已加载' + conversations.length + '条对话记忆');
                }
                
                console.log(`✅ 加载了 ${conversations.length} 条对话历史`);
            }
            
            this.showMemoryStatus('记忆系统就绪');
            
        } catch (error) {
            console.error('❌ 加载对话历史失败:', error);
            this.showMemoryStatus('记忆加载失败');
        }
    }
    
    updateCharacterUI() {
        if (!this.currentCharacter) return;
        
        // 更新角色名称显示
        const characterNameElement = document.getElementById('character-name');
        if (characterNameElement) {
            characterNameElement.textContent = this.currentCharacter.name;
        }
        
        // 更新头像
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
            // 根据亲密度显示不同数量的心
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
            
            // 3秒后自动隐藏
            setTimeout(() => {
                this.contextDisplay.style.display = 'none';
            }, 3000);
        }
    }
    
    setupEventListeners() {
        // 消息发送
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
        
        // 全局角色设置监听 - 防止循环调用
        window.setCurrentCharacterCallback = (character) => {
            // 🔄 防循环：只在角色真正不同时才设置
            if (!this.currentCharacter || 
                (this.currentCharacter.id || this.currentCharacter.name?.toLowerCase()) !== 
                (character.id || character.name?.toLowerCase())) {
                console.log('🔄 外部角色设置请求:', character.name);
                this.setCurrentCharacter(character);
            } else {
                console.log('🔄 跳过重复的外部角色设置:', character.name);
            }
        };
    }
    
    async handleSendMessage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (!message || this.isLoading) return;
        
        if (!this.currentUser || !this.currentCharacter) {
            this.showError('请先登录并选择角色');
            return;
        }
        
        try {
            this.isLoading = true;
            messageInput.value = '';
            
            // 显示用户消息
            const userMessage = {
                id: Date.now(),
                sender: 'user',
                content: message,
                timestamp: new Date().toISOString()
            };
            
            this.chatHistory.push(userMessage);
            this.updateChatUI(userMessage);
            
            // 显示记忆状态
            this.showMemoryStatus(window.i18n ? window.i18n.t('eliza.thinking') : 'AI正在思考...');
            this.showTypingIndicator();
            
            // 发送到ElizaOS后端
            const requestData = {
                userId: this.currentUser.id,
                characterId: this.currentCharacter.id.toLowerCase(),
                message: message
            };
            
            console.log('📤 发送到ElizaOS:', requestData);
            
            const response = await fetch(`${this.apiBaseURL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            console.log('🌐 HTTP响应状态:', response.status, response.statusText);
            console.log('🌐 HTTP响应头:', Object.fromEntries(response.headers.entries()));
            
            const data = await response.json();
            console.log('📨 ElizaOS响应:', data);
            console.log('📨 响应详情:', JSON.stringify(data, null, 2));
            
            if (data.success && data.data) {
                console.log('✅ 准备显示AI回复:', data.data.response);
                // AI回复消息
                const aiMessage = {
                    id: Date.now() + 1,
                    sender: 'ai',
                    content: data.data.response,
                    timestamp: new Date().toISOString(),
                    emotion: data.data.emotion || 'neutral',
                    relationshipLevel: data.data.relationship_level || 1
                };
                
                console.log('📝 AI消息对象:', aiMessage);
                this.chatHistory.push(aiMessage);
                
                // 更新关系数据
                if (data.data.relationship_level) {
                    this.relationshipData = {
                        ...this.relationshipData,
                        relationship_level: data.data.relationship_level
                    };
                    this.updateRelationshipUI();
                }
                
                // 延迟显示回复
                console.log('⏳ 准备在1秒后显示AI回复...');
                setTimeout(() => {
                    console.log('🎬 开始显示AI回复...');
                    this.hideTypingIndicator();
                    this.updateChatUI(aiMessage);
                    
                    // 🎤 存储语音数据并自动播放
                    if (aiMessage.audio && aiMessage.audio.data) {
                        this.voiceStorage.set(aiMessage.id, aiMessage.audio);
                        console.log('🎵 开始自动播放语音...');
                        this.playVoiceMessage(aiMessage.audio);
                    }
                    
                    // 触发VRM表情和语音
                    this.triggerVRMResponse(aiMessage);
                    
                    this.showMemoryStatus('记忆已更新');
                    
                    // 显示关系变化
                    if (data.data.relationship_level > (this.relationshipData?.relationship_level || 1)) {
                        this.showContextInfo(`亲密度提升到 ${data.data.relationship_level} 级！`);
                    }
                    
                }, 1000 + Math.random() * 2000);
                
            } else {
                console.error('❌ ElizaOS响应格式错误:', data);
                console.error('❌ 详细信息:', {
                    success: data.success,
                    hasData: !!data.data,
                    dataKeys: data.data ? Object.keys(data.data) : null,
                    error: data.error
                });
                throw new Error(data.error || '发送失败');
            }
            
        } catch (error) {
            console.error('❌ 消息发送失败:', error);
            this.hideTypingIndicator();
            this.showError('消息发送失败: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }
    
    updateChatUI(message, animate = true) {
        console.log('🎨 updateChatUI调用:', {
            sender: message.sender,
            content: message.content,
            animate: animate
        });
        
        const messagesContainer = document.getElementById('chat-window-messages');
        if (!messagesContainer) {
            console.error('❌ 找不到chat-window-messages容器');
            return;
        }
        
        console.log('📦 消息容器找到:', messagesContainer);
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender}-message`;
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${this.formatMessage(message.content)}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
                ${message.relationshipLevel ? 
                  `<div class="relationship-hint">亲密度: ${message.relationshipLevel}</div>` : ''}
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
        // 与VRM系统集成
        if (window.triggerExpression) {
            window.triggerExpression(message.emotion || 'neutral');
        }
        
        if (window.speakText && message.content) {
            window.speakText(message.content, this.currentCharacter?.voiceId);
        }
        
        console.log('😊 触发表情:', message.emotion);
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
            <div class="typing-text">${this.currentCharacter?.name || 'AI'} 正在输入...</div>
        `;
        indicator.style.display = 'none';
        
        messagesContainer.appendChild(indicator);
        return indicator;
    }
    
    formatMessage(content) {
        // 格式化消息，支持Emoji和链接
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
        
        // 显示错误提示
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
        // 认证失败处理
        this.currentUser = null;
        this.currentCharacter = null;
        this.showError('认证失败，请重新连接钱包');
        
        // 清除存储
        localStorage.removeItem('wallet_address');
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('selectedCharacter');
    }
    
    // 🔗 兼容性方法：确保与旧前端代码兼容
    setCharacter(character) {
        // 🔍 调用栈追踪 - 找出谁在反复调用
        const stack = new Error().stack;
        const caller = stack.split('\n')[2]?.trim() || 'unknown';
        console.log('🔗 兼容性调用: setCharacter ->', character.name, '调用者:', caller);
        
        // 改进的防重复逻辑 - 使用JSON比较确保完全相同
        if (this.currentCharacter) {
            const currentId = this.currentCharacter.id || this.currentCharacter.name?.toLowerCase();
            const newId = character.id || character.name?.toLowerCase();
            
            if (currentId === newId) {
                console.log('🔗 角色已设置，跳过重复调用 (ID匹配)');
                return Promise.resolve(); // 返回Promise保持一致性
            }
        }
        
        // 🚫 添加防抖 - 防止频繁调用
        if (this._setCharacterTimeout) {
            clearTimeout(this._setCharacterTimeout);
        }
        
        this._setCharacterTimeout = setTimeout(() => {
            console.log('🔗 执行角色设置:', character.name);
            this.setCurrentCharacter(character);
            this._setCharacterTimeout = null;
        }, 100); // 100ms防抖
        
        return Promise.resolve();
    }
    
    async sendMessage(message) {
        console.log('🔗 兼容性调用: sendMessage ->', message);
        
        if (!this.currentUser || !this.currentCharacter) {
            console.warn('⚠️ 用户或角色未设置，无法发送消息');
            return;
        }
        
        try {
            // 获取当前UI语言设置
            const currentLanguage = window.i18n ? window.i18n.getCurrentLanguage() : 'en';
            
            // 调用ElizaOS聊天API
            const response = await fetch(`${this.apiBaseURL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.currentUser.id,
                    characterId: this.currentCharacter.id,
                    message: message,
                    language: currentLanguage // 添加语言参数
                })
            });
            
            if (!response.ok) {
                throw new Error(`Chat API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📨 兼容性ElizaOS响应:', data);
            console.log('📨 兼容性响应详情:', JSON.stringify(data, null, 2));
            
            if (data.success && data.data) {
                // 创建用户消息
                const userMessage = {
                    id: Date.now(),
                    sender: 'user',
                    content: message,
                    timestamp: new Date()
                };
                
                // 创建AI回复消息
                const aiMessage = {
                    id: Date.now() + 1,
                    sender: 'ai',
                    content: data.data.response,
                    timestamp: new Date(),
                    emotion: data.data.emotion,
                    audio: data.data.audio // 🎤 添加语音数据
                };
                
                console.log('🖥️ 准备更新UI - 用户消息:', userMessage);
                console.log('🖥️ 准备更新UI - AI消息:', aiMessage);
                
                // 更新聊天界面
                this.updateChatUI(userMessage);
                console.log('✅ 用户消息UI已更新');
                
                this.updateChatUI(aiMessage);
                console.log('✅ AI消息UI已更新');
                
                // 🎤 存储语音数据并自动播放
                if (aiMessage.audio && aiMessage.audio.data) {
                    this.voiceStorage.set(aiMessage.id, aiMessage.audio);
                    console.log('🎵 开始自动播放语音...');
                    this.playVoiceMessage(aiMessage.audio);
                }
                
                console.log('✅ ElizaOS消息发送成功');
                return data.data;
            } else {
                throw new Error(data.error || '发送消息失败');
            }
        } catch (error) {
            console.error('❌ 兼容性sendMessage错误:', error);
            this.showError(`发送消息失败: ${error.message}`);
        }
    }
    
    async getUserStats() {
        console.log('🔗 兼容性调用: getUserStats');
        // 返回基本统计信息
        return {
            totalInteractions: this.chatHistory.length,
            lastInteraction: Date.now()
        };
    }
    
    // waitingForWallet 属性兼容
    get waitingForWallet() {
        return !this.currentUser;
    }
    
    set waitingForWallet(value) {
        // 兼容性设置，不做实际操作
        console.log('🔗 兼容性设置: waitingForWallet =', value);
    }
    
    // 🎤 语音播放功能
    playVoiceMessage(audioData) {
        try {
            console.log('🎵 开始播放语音...', {
                mimeType: audioData.mimeType,
                dataLength: audioData.data.length,
                voiceId: audioData.voiceId
            });
            
            this.tryPlayAudio(audioData);
            
        } catch (error) {
            console.error('❌ 语音处理失败:', error);
        }
    }
    
    // 🎤 尝试多种方式播放音频
    async tryPlayAudio(audioData) {
        const uint8Array = new Uint8Array(audioData.data);
        
        // 方法1: 尝试使用Blob URL (原方法)
        try {
            console.log('🎵 尝试方法1: Blob URL播放');
            const arrayBuffer = uint8Array.buffer;
            const blob = new Blob([arrayBuffer], { type: audioData.mimeType });
            const audioUrl = URL.createObjectURL(blob);
            
            const audio = new Audio();
            audio.volume = 0.8;
            
            // 设置回调
            audio.onplay = () => {
                console.log('✅ 语音开始播放 (Blob URL)');
                this.showVoiceStatus('🎵 播放中...');
            };
            
            audio.onended = () => {
                console.log('✅ 语音播放完成');
                this.hideVoiceStatus();
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (error) => {
                console.log('❌ Blob URL方法失败，尝试备用方案:', error);
                URL.revokeObjectURL(audioUrl);
                this.tryPlayAudioFallback(audioData);
            };
            
            audio.src = audioUrl;
            await audio.play();
            return;
            
        } catch (blobError) {
            console.log('❌ Blob URL方法失败，尝试备用方案:', blobError);
            this.tryPlayAudioFallback(audioData);
        }
    }
    
    // 🎤 备用音频播放方法
    tryPlayAudioFallback(audioData) {
        try {
            console.log('🎵 尝试方法2: Data URL播放');
            
            // 方法2: 使用Data URL
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
                console.log('✅ 语音开始播放 (Data URL)');
                this.showVoiceStatus('🎵 播放中...');
            };
            
            audio.onended = () => {
                console.log('✅ 语音播放完成');
                this.hideVoiceStatus();
            };
            
            audio.onerror = (error) => {
                console.error('❌ Data URL方法也失败了:', error);
                this.showVoiceStatus('❌ 语音播放失败');
                setTimeout(() => this.hideVoiceStatus(), 3000);
            };
            
            audio.src = dataUrl;
            audio.play().catch(error => {
                console.error('❌ Data URL播放启动失败:', error);
                this.showVoiceStatus('❌ 语音播放失败');
                setTimeout(() => this.hideVoiceStatus(), 3000);
            });
            
        } catch (fallbackError) {
            console.error('❌ 所有语音播放方法都失败了:', fallbackError);
            // 创建用户交互播放按钮
            this.showInteractivePlayButton(audioData);
        }
    }
    
    // 🎤 显示交互式播放按钮
    showInteractivePlayButton(audioData) {
        console.log('🎵 显示用户交互播放按钮');
        
        // 创建播放按钮
        let playButton = document.getElementById('interactive-voice-play');
        if (!playButton) {
            playButton = document.createElement('button');
            playButton.id = 'interactive-voice-play';
            playButton.innerHTML = '🎵 点击播放语音';
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
        
        // 更新按钮点击事件
        playButton.onclick = () => {
            console.log('👆 用户点击播放语音按钮');
            this.forcePlayAudio(audioData);
            playButton.remove();
        };
        
        // 5秒后自动隐藏按钮
        setTimeout(() => {
            if (playButton && playButton.parentNode) {
                playButton.remove();
            }
        }, 10000);
    }
    
    // 🎤 强制播放音频（需要用户交互）
    forcePlayAudio(audioData) {
        try {
            console.log('🎵 强制播放音频（用户交互）');
            
            // 使用最简单的方法播放
            const uint8Array = new Uint8Array(audioData.data);
            const arrayBuffer = uint8Array.buffer;
            const blob = new Blob([arrayBuffer], { type: audioData.mimeType });
            
            // 创建临时URL
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audio.volume = 0.8;
            
            audio.onplay = () => {
                console.log('✅ 用户交互语音播放成功');
                this.showVoiceStatus('🎵 播放中...');
            };
            
            audio.onended = () => {
                console.log('✅ 语音播放完成');
                this.hideVoiceStatus();
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (error) => {
                console.error('❌ 用户交互播放也失败了:', error);
                URL.revokeObjectURL(audioUrl);
                this.showVoiceStatus('❌ 语音播放失败');
                setTimeout(() => this.hideVoiceStatus(), 3000);
            };
            
            // 由于是用户交互触发，应该能成功播放
            audio.play();
            
        } catch (error) {
            console.error('❌ 强制播放失败:', error);
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
        console.log('🔗 设置兼容性别名: window.chatSystemV2 -> ElizaOS');
    }
});

// 导出类
export default ElizaOSChatSystem;