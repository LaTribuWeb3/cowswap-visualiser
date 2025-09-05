import mongoose, { Document, Schema } from 'mongoose';
import { type OrderUid, type Token, type TokenAmount, OrderKind } from './Types';


// Interface for the order document in MongoDB
export interface IOrderDocument extends Document {
  // Use orderUid as the document _id
  _id: OrderUid;
  
  // Request metadata
  auctionId: string;
  timestamp: Date;
  requestIp?: string;
  processingTimeMs?: number;
  
  // Order details
  sellToken: Token;
  buyToken: Token;
  sellAmount: TokenAmount;
  buyAmount: TokenAmount;
  kind: OrderKind;
  owner: string;
  
  // Our pricing and offer
  livePrice: number;        // The live market price we based our quote on
  markup: number;           // The markup we applied (in basis points)
  ourOffer: {
    sellAmount: TokenAmount; // How much we offered to sell
    buyAmount: TokenAmount;  // How much we offered to buy
    wasIncluded: boolean;    // Whether this order was included in our solution
  };
  
  // Future fields for competitive analysis (can be added later)
  competitors?: {
    [solverName: string]: {
      sellAmount?: TokenAmount;
      buyAmount?: TokenAmount;
      timestamp: Date;
    };
  };
  
  // Additional metadata that might be useful
  metadata?: {
    gasEstimate?: number;
    profitability?: number;
    priceDeviation?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

// Mongoose schema for orders
const OrderSchema = new Schema<IOrderDocument>({
  // Use orderUid as _id (no auto-generated ObjectId)
  _id: { type: String, required: true },
  
  // Request metadata
  auctionId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  requestIp: { type: String },
  processingTimeMs: { type: Number },
  
  // Order details
  sellToken: { type: String, required: true },
  buyToken: { type: String, required: true },
  sellAmount: { type: String, required: true },
  buyAmount: { type: String, required: true },
  kind: { type: String, required: true, enum: ['sell', 'buy'] },
  owner: { type: String, required: true },
  
  // Our pricing and offer
  livePrice: { type: Number, required: true },
  markup: { type: Number, required: true }, // in basis points
  ourOffer: {
    sellAmount: { type: String, required: true },
    buyAmount: { type: String, required: true },
    wasIncluded: { type: Boolean, required: true }
  },
  
  // Future fields for competitive analysis
  competitors: { type: Schema.Types.Mixed, default: {} },
  
  // Additional metadata
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'orders',
  _id: false // Don't auto-generate _id, we'll use orderUid
});

// Indexes for efficient querying
OrderSchema.index({ auctionId: 1, timestamp: -1 });
OrderSchema.index({ timestamp: -1 });
OrderSchema.index({ sellToken: 1, buyToken: 1 });
OrderSchema.index({ owner: 1 });
OrderSchema.index({ livePrice: 1 });
OrderSchema.index({ markup: 1 });

// Create and export the model
export const OrderModel = mongoose.model<IOrderDocument>('Order', OrderSchema);
