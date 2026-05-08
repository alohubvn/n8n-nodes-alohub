import { randomUUID } from 'crypto';
import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeOperationError,
	ResourceMapperFields,
} from 'n8n-workflow';

const BASE_URL = 'https://xapi.alohub.vn';
const REQUEST_TIMEOUT = 15000;

function generateTransactionId(): string {
	return `ah_n8n_${randomUUID()}`;
}

/**
 * Campaign value is encoded as "campaignId|znsTemplateId" so we can derive
 * the template mapping without re-fetching the entire campaign list.
 */
function parseCampaignValue(
	param: { value?: string | number } | string | number | undefined,
): { campaignId: number; znsTemplateId: string } {
	let raw: string = '';
	if (typeof param === 'object' && param !== null) {
		raw = String(param.value ?? '');
	} else if (param !== undefined) {
		raw = String(param);
	}

	const [idPart, tmplPart] = raw.split('|');
	return {
		campaignId: Number(idPart) || 0,
		znsTemplateId: tmplPart || '',
	};
}

function parseApiResponse(
	body: IDataObject,
	httpStatus: number,
	transactionId: string,
	resource: string,
	operation: string,
): IDataObject {
	return {
		...body,
		success: String(body.success) === '1',
		httpStatus,
		transactionId,
		resource,
		operation,
		timestamp: new Date().toISOString(),
	};
}

// ── Node definition ──────────────────────────────────────────────────────────
export class Alohub implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Alohub',
		name: 'alohub',
		icon: 'file:alohub.svg',
		group: ['output'],
		version: 1,
		subtitle:
			'={{ ({voice:"Voice",zns:"Zalo ZNS"}[$parameter["resource"]] || $parameter["resource"]) + ": " + ({makeACall:"Click to Call",textToSpeech:"Text to Speech",playAudio:"Play Audio",send:"Send ZNS"}[$parameter["operation"]] || $parameter["operation"]) }}',
		description: 'Send Zalo ZNS notifications and make voice calls via Alohub CPaaS',
		defaults: { name: 'Alohub' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				// eslint-disable-next-line @n8n/community-nodes/no-credential-reuse
				name: 'alohubApi',
				required: true,
			},
		],
		properties: [
			// ── Resource ────────────────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Voice', value: 'voice' },
					{ name: 'Zalo ZNS Notification', value: 'zns' },
				],
				default: 'voice',
			},

			// ── Voice operations ─────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['voice'] } },
				options: [
					{ name: 'Click to Call', value: 'makeACall', action: 'Click to call via IP phone' },
					{ name: 'Play Audio', value: 'playAudio', action: 'Call and play an audio file' },
					{ name: 'Text to Speech', value: 'textToSpeech', action: 'Call and read text aloud' },
				],
				default: 'makeACall',
			},

			// ── ZNS operations ───────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['zns'] } },
				options: [{ name: 'Send', value: 'send', action: 'Send ZNS' }],
				default: 'send',
			},

			// ════════════════════════════════════════════════════════════════
			// Voice — Click to Call
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Phone Number',
				name: 'phoneNumber',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0912345678',
				description: 'Recipient phone number to call',
				displayOptions: { show: { resource: ['voice'], operation: ['makeACall'] } },
			},
			{
				displayName: 'IP Phone',
				name: 'ipPhone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '6688',
				description: 'IP phone extension number (e.g. 6688)',
				displayOptions: { show: { resource: ['voice'], operation: ['makeACall'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// Voice — Text to Speech
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Phone Number',
				name: 'ttsPhone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0912345678',
				description: 'Recipient phone number to call',
				displayOptions: { show: { resource: ['voice'], operation: ['textToSpeech'] } },
			},
			{
				displayName: 'Text Content',
				name: 'ttsText',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 3 },
				placeholder: 'Mã xác nhận của bạn là 482615',
				description: 'Text that will be read aloud during the call (TTS)',
				displayOptions: { show: { resource: ['voice'], operation: ['textToSpeech'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// Voice — Play Audio File
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Phone Number',
				name: 'audioPhone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0912345678',
				description: 'Recipient phone number to call',
				displayOptions: { show: { resource: ['voice'], operation: ['playAudio'] } },
			},
			{
				displayName: 'Audio Source',
				name: 'audioSource',
				type: 'options',
				options: [
					{ name: 'Binary Data (From Previous Node)', value: 'binary' },
					{ name: 'URL (Direct Link)', value: 'url' },
				],
				default: 'url',
				description: 'Where to get the audio file from',
				displayOptions: { show: { resource: ['voice'], operation: ['playAudio'] } },
			},
			{
				displayName: 'Audio URL',
				name: 'audioUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/audio.mp3',
				description: 'Direct URL to the audio file (MP3, WAV, M4A)',
				displayOptions: { show: { resource: ['voice'], operation: ['playAudio'], audioSource: ['url'] } },
			},
			{
				displayName: 'Binary Property',
				name: 'audioFile',
				type: 'string',
				required: true,
				default: 'data',
				description: 'Name of the binary property containing the audio file (MP3, WAV, M4A)',
				displayOptions: { show: { resource: ['voice'], operation: ['playAudio'], audioSource: ['binary'] } },
			},

			// ════════════════════════════════════════════════════════════════
			// ZNS — Send
			// ════════════════════════════════════════════════════════════════
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0912345678',
				description: 'Recipient phone number (must have a Zalo account)',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},
			{
				displayName: 'Campaign',
				name: 'campaignId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				description: 'Select a ZNS campaign to send',
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						placeholder: 'Select a campaign...',
						typeOptions: {
							searchListMethod: 'searchCampaigns',
							searchable: true,
							searchFilterRequired: false,
						},
					},
				],
			},
			{
				displayName: 'Template Parameters',
				name: 'templateParams',
				type: 'resourceMapper',
				noDataExpression: true,
				default: {
					mappingMode: 'defineBelow',
					value: null,
				},
				required: true,
				typeOptions: {
					loadOptionsDependsOn: ['campaignId.value'],
					resourceMapper: {
						resourceMapperMethod: 'getTemplateParams',
						mode: 'add',
						fieldWords: { singular: 'parameter', plural: 'parameters' },
						addAllFields: true,
						multiKeyMatch: false,
						supportAutoMap: false,
					},
				},
				displayOptions: { show: { resource: ['zns'], operation: ['send'] } },
			},
		],
		usableAsTool: true,
	};

	methods = {
		listSearch: {
			async searchCampaigns(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const page = paginationToken ? parseInt(paginationToken, 10) : 1;
				const limit = 25;

				const body: IDataObject = { page, limit };
				if (filter) body.campaignName = filter;

				try {
					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/campaign/list`,
							headers: { 'Content-Type': 'application/json' },
							body,
							json: true,
							timeout: REQUEST_TIMEOUT,
						},
					);

					const data = ((response as IDataObject).data as IDataObject[]) || [];
					const totalRecord = Number((response as IDataObject).totalRecord) || 0;

					const results: INodeListSearchItems[] = data.map((c) => ({
						name: `${c.campaignName as string} (ID: ${c.campaignId})`,
						value: `${c.campaignId}|${c.znsTemplateId as string}`,
						description: `ZNS Template: ${c.znsTemplateId as string}`,
					}));

					const hasMore = page * limit < totalRecord;
					return {
						results,
						paginationToken: hasMore ? String(page + 1) : undefined,
					};
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to search campaigns: ${(error as Error).message}`,
					);
				}
			},
		},
		resourceMapping: {
			async getTemplateParams(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
				const campaignParam = this.getCurrentNodeParameter('campaignId') as
					| { value?: string | number }
					| string
					| number
					| undefined;

				const { znsTemplateId } = parseCampaignValue(campaignParam);
				if (!znsTemplateId) return { fields: [] };

				try {
					const tmplRes = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/zns/template`,
							headers: { 'Content-Type': 'application/json' },
							body: { includeMappings: true, includeParams: true },
							json: true,
							timeout: REQUEST_TIMEOUT,
						},
					);
					const templates = ((tmplRes as IDataObject).data as IDataObject[]) || [];
					const template = templates.find((t) => t.templateId === znsTemplateId);
					if (!template) return { fields: [] };

					const mappings = (template.paramMappings as IDataObject[]) || [];
					const params = (template.params as IDataObject[]) || [];

					const fields = mappings
						.filter((m) => !!m.sourceColumn)
						.map((m) => {
							const paramName = m.paramName as string;
							const sourceColumn = m.sourceColumn as string;
							const paramInfo = params.find((p) => p.paramName === paramName);

							return {
								id: sourceColumn,
								displayName: paramName,
								required: (paramInfo?.required as boolean) ?? true,
								defaultMatch: false,
								display: true,
								type: 'string' as const,
								canBeUsedToMatch: false,
							};
						});

					return { fields };
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load template parameters: ${(error as Error).message}`,
					);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			let responseData: IDataObject;

			try {
				let transactionId = '';
				let httpStatus = 0;

				// ── Voice: Click to Call ─────────────────────────────────────
				if (resource === 'voice' && operation === 'makeACall') {
					const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
					const ipPhone = this.getNodeParameter('ipPhone', i) as string;
					transactionId = generateTransactionId();

					const body: IDataObject = { phoneNumber, ipPhone, transactionId };

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/voice/click-to-call`,
							headers: { 'Content-Type': 'application/json' },
							body,
							json: true,
							returnFullResponse: true,
							timeout: REQUEST_TIMEOUT,
						},
					);
					const fullRes = response as IDataObject;
					httpStatus = (fullRes.statusCode as number) || 0;
					responseData = (fullRes.body as IDataObject) || fullRes;
				}

				// ── Voice: Text to Speech ────────────────────────────────────
				else if (resource === 'voice' && operation === 'textToSpeech') {
					const phone = this.getNodeParameter('ttsPhone', i) as string;
					const otp = this.getNodeParameter('ttsText', i) as string;
					transactionId = generateTransactionId();

					const body: IDataObject = { phone, otp, transactionId };

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/voice/text-to-speech`,
							headers: { 'Content-Type': 'application/json' },
							body,
							json: true,
							returnFullResponse: true,
							timeout: REQUEST_TIMEOUT,
						},
					);
					const fullRes = response as IDataObject;
					httpStatus = (fullRes.statusCode as number) || 0;
					responseData = (fullRes.body as IDataObject) || fullRes;
				}

				// ── Voice: Play Audio File ───────────────────────────────────
				else if (resource === 'voice' && operation === 'playAudio') {
					const phone = this.getNodeParameter('audioPhone', i) as string;
					const audioSource = this.getNodeParameter('audioSource', i) as string;
					transactionId = generateTransactionId();

					let dataBuffer: Buffer;
					let mimeType = 'audio/mpeg';
					let fileName = 'audio.mp3';

					if (audioSource === 'url') {
						const audioUrl = this.getNodeParameter('audioUrl', i) as string;
						const downloaded = (await this.helpers.httpRequest({
							method: 'GET',
							url: audioUrl,
							encoding: 'arraybuffer',
							timeout: REQUEST_TIMEOUT,
						})) as Buffer;
						dataBuffer = Buffer.from(downloaded);

						const urlLower = audioUrl.toLowerCase();
						if (urlLower.includes('.wav')) {
							mimeType = 'audio/wav';
							fileName = 'audio.wav';
						} else if (urlLower.includes('.m4a')) {
							mimeType = 'audio/m4a';
							fileName = 'audio.m4a';
						}
					} else {
						const binaryPropertyName = this.getNodeParameter('audioFile', i) as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
						dataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						mimeType = binaryData.mimeType || 'audio/mpeg';
						fileName = binaryData.fileName || 'audio.mp3';
					}

					const credentials = await this.getCredentials('alohubApi');
					const apiKey = credentials.apiKey as string;

					const rawResponse = (await this.helpers.request({
						method: 'POST',
						uri: `${BASE_URL}/v1/voice/tts/audio`,
						headers: {
							'X-Api-Key': apiKey,
						},
						formData: {
							phone,
							file: {
								value: dataBuffer,
								options: {
									filename: fileName,
									contentType: mimeType,
								},
							},
						},
						timeout: REQUEST_TIMEOUT,
					})) as string;

					httpStatus = 200;
					try {
						responseData = JSON.parse(rawResponse) as IDataObject;
					} catch {
						responseData = { rawResponse } as IDataObject;
					}
				}

				// ── ZNS: Send ────────────────────────────────────────────────
				else if (resource === 'zns' && operation === 'send') {
					const phone = this.getNodeParameter('phone', i) as string;
					const campaignParam = this.getNodeParameter('campaignId', i) as
						| { value?: string | number }
						| string
						| number;
					const { campaignId } = parseCampaignValue(campaignParam);
					const templateParams = this.getNodeParameter('templateParams', i, {}) as {
						value?: IDataObject;
					};
					transactionId = generateTransactionId();

					const body: IDataObject = { phone, campaignId, transactionId };

					const paramValues = templateParams.value || {};
					for (const [key, value] of Object.entries(paramValues)) {
						if (key.startsWith('__static_')) continue;
						if (value !== '' && value !== undefined && value !== null) {
							body[key] = value;
						}
					}

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'alohubApi',
						{
							method: 'POST',
							url: `${BASE_URL}/v1/zns/send`,
							headers: { 'Content-Type': 'application/json' },
							body,
							json: true,
							returnFullResponse: true,
							timeout: REQUEST_TIMEOUT,
						},
					);
					const fullRes = response as IDataObject;
					httpStatus = (fullRes.statusCode as number) || 0;
					responseData = (fullRes.body as IDataObject) || fullRes;
				}

				else {
					throw new NodeOperationError(
						this.getNode(),
						`Resource "${resource}" / operation "${operation}" is not supported`,
					);
				}

				// ── Handle API response ──────────────────────────────────────
				const enriched = parseApiResponse(responseData, httpStatus, transactionId, resource, operation);

				if (String(responseData.success) !== '1') {
					const code = String(responseData.error_code ?? '');
					const message = (responseData.error_message as string) || 'Unknown error';

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								...enriched,
								success: false,
								errorCode: code,
								errorMessage: message,
							},
							pairedItem: { item: i },
						});
						continue;
					}

					throw new NodeOperationError(
						this.getNode(),
						`Alohub API error [${code}]: ${message} (Transaction: ${transactionId})`,
					);
				}

				returnData.push({
					json: enriched,
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: (error as Error).message,
							timestamp: new Date().toISOString(),
						},
						pairedItem: { item: i },
					});
				} else {
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
			}
		}

		return [returnData];
	}
}
