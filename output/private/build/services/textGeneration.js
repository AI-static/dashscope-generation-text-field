"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextGenerationService = void 0;
const openai_1 = __importDefault(require("openai"));
class TextGenerationService {
    constructor(apiKey, baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1") {
        this.openai = new openai_1.default({
            apiKey: apiKey,
            baseURL: baseURL
        });
    }
    /**
     * 获取支持的文本生成模型列表
     */
    static getSupportedModels() {
        return [
            {
                value: 'qwen-turbo',
                name: 'Qwen Turbo',
                description: '快速响应，适合日常对话',
                supportsThinking: false,
                supportsVision: false
            },
            {
                value: 'qwen-plus',
                name: 'Qwen Plus',
                description: '均衡性能，适合大多数场景',
                supportsThinking: false,
                supportsVision: false
            },
            {
                value: 'qwen-max',
                name: 'Qwen Max',
                description: '最强性能，适合复杂任务',
                supportsThinking: true,
                supportsVision: false
            },
            {
                value: 'qwen-long',
                name: 'Qwen Long',
                description: '长文本处理，支持超长上下文',
                supportsThinking: false,
                supportsVision: false
            },
            {
                value: 'qwen3-vl-plus',
                name: 'Qwen3-VL-Plus',
                description: '视觉语言模型，支持图片理解',
                supportsThinking: false,
                supportsVision: true
            },
            {
                value: 'qwen3-vl-flash',
                name: 'Qwen3-VL-Flash',
                description: 'Qwen3系列小尺寸视觉理解模型，支持思考模式与视觉理解',
                supportsThinking: true,
                supportsVision: true
            }
        ];
    }
    /**
     * 提取文本中的图片URL
     * @param text 输入文本
     * @returns 包含图片URL数组和处理后文本的对象
     */
    static extractImageUrls(text) {
        // 支持的图片后缀
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        // 匹配URL的正则表达式
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = text.match(urlRegex) || [];
        // 过滤出图片URL
        const imageUrls = urls.filter(url => {
            const lowerUrl = url.toLowerCase();
            return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
                lowerUrl.includes('img.alicdn.com') ||
                lowerUrl.includes('image') ||
                lowerUrl.includes('pic') ||
                lowerUrl.includes('photo');
        });
        // 从文本中移除图片URL
        let cleanedText = text;
        imageUrls.forEach(url => {
            cleanedText = cleanedText.replace(url, '').trim();
        });
        return {
            images: imageUrls,
            text: cleanedText
        };
    }
    /**
     * 使用 OpenAI SDK 进行文本生成（支持多模态）
     * @param prompt 用户输入的提示词
     * @param model 使用的模型名称
     * @param enableThinking 是否启用深度思考模式
     * @param imageUrls 直接传入的图片URL数组（从附件获取）
     * @returns 生成的文本内容和 token 使用量
     */
    async generateTextWithUsage(prompt, model = 'qwen-plus', enableThinking = false, imageUrls) {
        try {
            // 获取模型信息
            const modelInfo = TextGenerationService.getSupportedModels().find(m => m.value === model);
            const modelSupportsVision = modelInfo?.supportsVision || false;
            // 从prompt中提取图片URL
            const { images: promptImages, text: cleanedPrompt } = TextGenerationService.extractImageUrls(prompt);
            // 合并附件图片和prompt中的图片
            const allImages = [...(imageUrls || []), ...promptImages];
            // 构建消息内容
            let userContent = cleanedPrompt;
            // 如果有图片且模型支持视觉，构建多模态消息
            if (allImages.length > 0 && modelSupportsVision) {
                userContent = [
                    ...allImages.map(img => ({ type: "image_url", image_url: { url: img } })),
                    { type: "text", text: cleanedPrompt }
                ];
            }
            else if (allImages.length > 0 && !modelSupportsVision) {
                // 如果有图片但模型不支持视觉，在prompt中提示
                userContent = `${cleanedPrompt}\n\n注意：检测到 ${allImages.length} 张图片（附件${imageUrls?.length || 0}张，文本中${promptImages.length}张），但当前模型不支持图片理解。请使用支持视觉的模型（如Qwen3-VL系列）。`;
            }
            const requestBody = {
                model: model,
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: userContent }
                ],
            };
            // 如果启用深度思考模式，添加 extra_body 参数
            if (enableThinking) {
                requestBody.extra_body = {
                    enable_thinking: true,
                    thinking_budget: 81920 // 设置最大推理过程 Token 数
                };
            }
            const completion = await this.openai.chat.completions.create(requestBody);
            if (completion.choices && completion.choices.length > 0) {
                let content = completion.choices[0].message.content || '未获取到回复内容';
                // 如果启用了思考模式，尝试从响应中获取思考内容
                if (enableThinking && completion.choices[0].message.thinking) {
                    const thinking = completion.choices[0].message.thinking;
                    content = `思考过程：\n${thinking}\n\n回复：\n${content}`;
                }
                // 如果处理了图片，在回复中注明
                if (allImages.length > 0 && modelSupportsVision) {
                    const attachmentCount = imageUrls?.length || 0;
                    const promptImageCount = promptImages.length;
                    let imageInfo = '';
                    if (attachmentCount > 0 && promptImageCount > 0) {
                        imageInfo = `[已识别并处理 ${allImages.length} 张图片（附件${attachmentCount}张，文本中${promptImageCount}张）]`;
                    }
                    else if (attachmentCount > 0) {
                        imageInfo = `[已识别并处理 ${attachmentCount} 张附件图片]`;
                    }
                    else if (promptImageCount > 0) {
                        imageInfo = `[已识别并处理 ${promptImageCount} 张图片链接]`;
                    }
                    content = `${imageInfo}\n\n${content}`;
                }
                return {
                    content: content,
                    totalTokens: completion.usage?.total_tokens || 0
                };
            }
            throw new Error('文本生成失败: 未获取到有效回复');
        }
        catch (error) {
            if (error.status) {
                // API 返回了错误状态码
                throw new Error(`API 请求失败 (${error.status}): ${error.message || error.error?.message || JSON.stringify(error)}`);
            }
            else {
                throw new Error(`文本生成失败: ${error.message}`);
            }
        }
    }
    /**
     * 使用 OpenAI SDK 进行文本生成（兼容旧版本）
     * @param prompt 用户输入的提示词
     * @param model 使用的模型名称
     * @returns 生成的文本内容
     */
    async generateText(prompt, model = 'qwen-plus') {
        const result = await this.generateTextWithUsage(prompt, model);
        return result.content;
    }
    /**
     * 流式文本生成（如果需要的话）
     * @param prompt 用户输入的提示词
     * @param model 使用的模型名称
     * @param onChunk 接收到数据块时的回调函数
     */
    async generateTextStream(prompt, model = 'qwen-plus', onChunk) {
        try {
            const stream = await this.openai.chat.completions.create({
                model: model,
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    { role: "user", content: prompt }
                ],
                stream: true,
            });
            let fullResponse = '';
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    onChunk(content);
                }
            }
            return fullResponse;
        }
        catch (error) {
            if (error.status) {
                throw new Error(`API 请求失败 (${error.status}): ${error.message || error.error?.message || JSON.stringify(error)}`);
            }
            else {
                throw new Error(`流式文本生成失败: ${error.message}`);
            }
        }
    }
}
exports.TextGenerationService = TextGenerationService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEdlbmVyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2VydmljZXMvdGV4dEdlbmVyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsb0RBQTRCO0FBWTVCLE1BQWEscUJBQXFCO0lBR2hDLFlBQVksTUFBYyxFQUFFLFVBQWtCLG1EQUFtRDtRQUMvRixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZ0JBQU0sQ0FBQztZQUN2QixNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU8sRUFBRSxPQUFPO1NBQ2pCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxrQkFBa0I7UUFPdkIsT0FBTztZQUNMO2dCQUNFLEtBQUssRUFBRSxZQUFZO2dCQUNuQixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsV0FBVyxFQUFFLGFBQWE7Z0JBQzFCLGdCQUFnQixFQUFFLEtBQUs7Z0JBQ3ZCLGNBQWMsRUFBRSxLQUFLO2FBQ3RCO1lBQ0Q7Z0JBQ0UsS0FBSyxFQUFFLFdBQVc7Z0JBQ2xCLElBQUksRUFBRSxXQUFXO2dCQUNqQixXQUFXLEVBQUUsY0FBYztnQkFDM0IsZ0JBQWdCLEVBQUUsS0FBSztnQkFDdkIsY0FBYyxFQUFFLEtBQUs7YUFDdEI7WUFDRDtnQkFDRSxLQUFLLEVBQUUsVUFBVTtnQkFDakIsSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLFdBQVcsRUFBRSxhQUFhO2dCQUMxQixnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixjQUFjLEVBQUUsS0FBSzthQUN0QjtZQUNEO2dCQUNFLEtBQUssRUFBRSxXQUFXO2dCQUNsQixJQUFJLEVBQUUsV0FBVztnQkFDakIsV0FBVyxFQUFFLGVBQWU7Z0JBQzVCLGdCQUFnQixFQUFFLEtBQUs7Z0JBQ3ZCLGNBQWMsRUFBRSxLQUFLO2FBQ3RCO1lBQ0Q7Z0JBQ0UsS0FBSyxFQUFFLGVBQWU7Z0JBQ3RCLElBQUksRUFBRSxlQUFlO2dCQUNy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