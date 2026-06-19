export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function GET() {
  // Generate a standard Automotive Inventory XML feed (compatible with Facebook Catalog / DealerVault)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<inventory>
  <dealer>
    <id>DH-1001</id>
    <name>DealerHunt Auto Sales</name>
    <phone>555-019-8472</phone>
    <address>123 Dealer Row, Dallas, TX 75001</address>
  </dealer>
  <vehicles>
    <vehicle>
      <id>1</id>
      <vin>1FTEW1E51LKD9281</vin>
      <year>2021</year>
      <make>Ford</make>
      <model>F-150</model>
      <trim>Lariat 4x4</trim>
      <price>38500</price>
      <mileage>42000</mileage>
      <condition>Used</condition>
      <exteriorColor>Oxford White</exteriorColor>
      <image_url>https://images.unsplash.com/photo-1605816988015-4fa2c6cd6921?auto=format&amp;fit=crop&amp;q=80&amp;w=800</image_url>
    </vehicle>
    <vehicle>
      <id>2</id>
      <vin>3TMCZ5AN1KM09121</vin>
      <year>2019</year>
      <make>Toyota</make>
      <model>Tacoma</model>
      <trim>TRD Off-Road</trim>
      <price>24000</price>
      <mileage>68000</mileage>
      <condition>Used</condition>
      <exteriorColor>Cement</exteriorColor>
      <image_url>https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&amp;fit=crop&amp;q=80&amp;w=800</image_url>
    </vehicle>
  </vehicles>
</inventory>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
