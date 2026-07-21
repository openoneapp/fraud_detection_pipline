"use client";
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapCardProps {
  lat: number;
  lng: number;
  addressLabel?: string;
}

export default function DebitAddressMap({ lat, lng, addressLabel = "Debit Location" }: MapCardProps) {
  const position: [number, number] = [lat, lng];

  return (
    <Card className="h-[70%] flex flex-col">
      <CardHeader>
        <CardTitle>Debit Address (Map)</CardTitle>
      </CardHeader>
      
      {/* 
        Note: We use flex-1 and a relative container so the map 
        calculates its height based on the remaining card space.
      */}
      <CardContent className="flex-1 w-full pb-6 relative min-h-[300px]">
        <MapContainer 
          center={position} 
          zoom={13} 
          scrollWheelZoom={false}
          className="h-full w-full rounded-md z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={customIcon}>
            <Popup>
              {addressLabel} <br /> {lat}, {lng}
            </Popup>
          </Marker>
        </MapContainer>
      </CardContent>
    </Card>
  );
}