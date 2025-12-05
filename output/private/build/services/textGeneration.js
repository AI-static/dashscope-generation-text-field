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
                description: '快速响应，适合日常对话'
            },
            {
                value: 'qwen-plus',
                name: 'Qwen Plus',
                description: '均衡性能，适合大多数场景'
            },
            {
                value: 'qwen-max',
                name: 'Qwen Max',
                description: '最强性能，适合复杂任务'
            },
            {
                value: 'qwen-long',
                name: 'Qwen Long',
                description: '长文本处理，支持超长上下文'
            },
            {
                value: 'qwen3-vl-plus',
                name: 'Qwen3-VL-Plus',
                description: '视觉语言模型，支持图片理解'
            },
            {
                value: 'qwen3-vl-flash',
                name: 'Qwen3-VL-Flash',
                description: 'Qwen3系列小尺寸视觉理解模型，支持思考模式与视觉理解'
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
     * @returns 生成的文本内容和 token 使用量
     */
    async generateTextWithUsage(prompt, model = 'qwen-plus', enableThinking = false) {
        try {
            // 提取图片URL
            const { images, text } = TextGenerationService.extractImageUrls(prompt);
            // 构建消息内容
            let userContent = text;
            // 如果有图片且是多模态模型，构建多模态消息
            if (images.length > 0 && (model.includes('vl') || model.includes('vision'))) {
                userContent = [
                    ...images.map(img => ({ type: "image_url", image_url: { url: img } })),
                    { type: "text", text }
                ];
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
                // 如果检测到图片，在回复中注明
                if (images.length > 0) {
                    content = `[已识别 ${images.length} 张图片]\n\n${content}`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dEdlbmVyYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2VydmljZXMvdGV4dEdlbmVyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsb0RBQTRCO0FBWTVCLE1BQWEscUJBQXFCO0lBR2hDLFlBQVksTUFBYyxFQUFFLFVBQWtCLG1EQUFtRDtRQUMvRixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZ0JBQU0sQ0FBQztZQUN2QixNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU8sRUFBRSxPQUFPO1NBQ2pCLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxrQkFBa0I7UUFDdkIsT0FBTztZQUNMO2dCQUNFLEtBQUssRUFBRSxZQUFZO2dCQUNuQixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsV0FBVyxFQUFFLGFBQWE7YUFDM0I7WUFDRDtnQkFDRSxLQUFLLEVBQUUsV0FBVztnQkFDbEIsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLFdBQVcsRUFBRSxjQUFjO2FBQzVCO1lBQ0Q7Z0JBQ0UsS0FBSyxFQUFFLFVBQVU7Z0JBQ2pCLElBQUksRUFBRSxVQUFVO2dCQUNoQixXQUFXLEVBQUUsYUFBYTthQUMzQjtZQUNEO2dCQUNFLEtBQUssRUFBRSxXQUFXO2dCQUNsQixJQUFJLEVBQUUsV0FBVztnQkFDakIsV0FBVyxFQUFFLGVBQWU7YUFDN0I7WUFDRDtnQkFDRSxLQUFLLEVBQUUsZUFBZTtnQkFDdEIsSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLFdBQVcsRUFBRSxlQUFlO2FBQzdCO1lBQ0Q7Z0JBQ0UsS0FBSyxFQUFFLGdCQUFnQjtnQkFDdkIsSUFBSSxFQUFFLGdCQUFnQjtnQkFDdEIsV0FBVyxFQUFFLDhCQUE4QjthQUM1QztTQUNGLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFZO1FBQ2xDLFVBQVU7UUFD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