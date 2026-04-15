import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AlohubApi implements ICredentialType {
	name = 'alohubApi';
	icon = 'file:alohub.svg' as const;
	displayName = 'Alohub API';
	documentationUrl = 'https://alohub.vn/docs/api';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Get your API key from Alohub dashboard',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Api-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'xapi.alohub.vn',
			url: '/v1/voice/click-to-call',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ phoneNumber: '0000000000', ipPhone: '0000' }),
		},
	};
}
