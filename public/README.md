# CoW Protocol Trade Visualizer UI

A beautiful, modern web interface for visualizing CoW Protocol trade settlements and clearing prices.

## Features

### 🎨 Modern Design
- Clean, responsive design with glassmorphism effects
- Beautiful gradient backgrounds and smooth animations
- Mobile-friendly layout that works on all devices

### 📊 Trade Information Display
- **Trades List**: Overview of all recent trades with key information at a glance
- **Trade Overview**: Transaction hash, block number, status, and gas usage
- **Tokens & Clearing Prices**: Visual representation of all tokens involved with their clearing prices
- **Trade Details**: Clear buy/sell flow with token amounts and exchange rates
- **Additional Details**: Receiver address, validity period, app data, and flags
- **Interactions**: Detailed view of all contract interactions

### 🔧 Interactive Features
- Click on hash values to copy them to clipboard
- Hover over long data to see full content
- Responsive design that adapts to screen size
- Smooth animations and transitions

## How to Use

1. **Start the server**:
   ```bash
   npm run ui
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:8081
   ```

3. **View the trade visualization**:
   - The UI displays a list of all trades with key information
   - Click on any trade to see detailed information
   - Use the back button to return to the trades list
   - All fields are properly formatted and easy to read
   - Long values are truncated but expand on hover

## Understanding the Data

### Clearing Prices Relationship
The UI clearly shows how clearing prices relate to trades:

1. **Token Indices**: Each trade uses `sellTokenIndex` and `buyTokenIndex` to reference tokens
2. **Price Matching**: Clearing prices at the same indices provide the exchange rates
3. **Visual Flow**: The trade flow shows the relationship between sell/buy tokens and their prices

### Example from Your Data
- **Sell Token**: USDC (Index 2) at price `0.000000000597418448`
- **Buy Token**: EURe (Index 3) at price `0.00000000069853`
- **Exchange Rate**: ~1.169 (calculated from the price ratio)

## Customization

### Adding New Token Information
Update the `tokenInfo` object in `script.js`:

```javascript
const tokenInfo = {
    "0xYourTokenAddress": {
        symbol: "SYMBOL",
        name: "Token Name",
        decimals: 18
    }
};
```

### Modifying the Data Source
Replace the `tradeData` object in `script.js` with your actual parsed data from the Ethereum service.

### Styling Changes
Modify `styles.css` to customize colors, fonts, and layout.

## Technical Details

- **Frontend**: Pure HTML, CSS, and JavaScript
- **Backend**: Express.js server for serving static files
- **Data Format**: Compatible with your parsed Ethereum transaction data
- **Responsive**: Works on desktop, tablet, and mobile devices

## Development

For development with auto-reload:
```bash
npm run ui:dev
```

The server will automatically restart when you make changes to the files.
