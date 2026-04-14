# n8n-nodes-alohub

![n8n community node](https://img.shields.io/badge/n8n-community%20node-ff6d5a)
![npm](https://img.shields.io/npm/v/n8n-nodes-alohub)
![license](https://img.shields.io/npm/l/n8n-nodes-alohub)

[n8n](https://n8n.io/) community node for [Alohub](https://alohub.vn) CPaaS platform. Make voice calls (Click a Call) and send Zalo ZNS notifications directly from your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Features

- **Voice - Click to Call**: Initiate outbound calls via IP phone extension
- **Zalo ZNS - Send**: Send Zalo ZNS notifications with dynamic template parameters
- **Campaign search**: Search and select ZNS campaigns with pagination
- **Dynamic template mapping**: Automatically loads template parameters based on selected campaign
- **AI Agent compatible**: Use as a tool in n8n AI Agent workflows 

## Installation

### In n8n (Community Nodes)

1. Go to **Settings > Community Nodes**
2. Click **Install a community node**
3. Enter `n8n-nodes-alohub`
4. Click **Install**

### Via npm (self-hosted)

```bash
npm install n8n-nodes-alohub
```

## Credentials

You need an **Alohub API Key** to use this node.

| Field   | Description                         |
| ------- | ----------------------------------- |
| API Key | Your Alohub API key from dashboard  |

The API key is sent as `X-Api-Key` header with every request.

## Operations

### Voice

| Operation    | Description                                              |
| ------------ | -------------------------------------------------------- |
| Make a Call  | Click to Call — connects a phone number to an IP phone extension |

**Parameters:**

| Parameter    | Required | Description                          |
| ------------ | -------- | ------------------------------------ |
| Phone Number | Yes      | Recipient phone number to call       |
| IP Phone     | Yes      | IP phone extension (e.g. `6688`)     |

A unique `transactionId` is generated automatically for each call.

### Zalo ZNS Notification

| Operation | Description                                |
| --------- | ------------------------------------------ |
| Send      | Send a Zalo ZNS notification to a phone number |

**Parameters:**

| Parameter           | Required | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| Phone               | Yes      | Recipient phone number (must have a Zalo account)        |
| Campaign            | Yes      | Select from a searchable list of ZNS campaigns           |
| Template Parameters | Yes      | Dynamically loaded based on selected campaign's template |

**How template parameters work:**

1. Select a campaign from the dropdown (supports search + infinite scroll)
2. The node fetches the ZNS template associated with that campaign
3. Template parameter fields are automatically displayed based on the template mapping
4. Fill in the parameter values (e.g. `customer_name`, `phone_number`)
5. Static parameters configured server-side are handled automatically

## Error Handling

The node provides detailed error information:

- `success` — boolean indicating API call result
- `httpStatus` — HTTP status code (200, 400, 401, 500, etc.)
- `error_code` — Alohub API error code
- `error_message` — Human-readable error message from Alohub
- `transactionId` — Unique ID for tracking and reconciliation

Enable **Continue On Error** in node settings to capture errors in output instead of stopping the workflow.

## Compatibility

- n8n version: >= 1.0.0
- Tested on: n8n 2.15.0

## Resources

- [Alohub Website](https://alohub.vn)
- [Alohub Docs](https://developers.alohub.vn/)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
