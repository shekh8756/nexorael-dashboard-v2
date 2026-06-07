"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ArtistsPage() {
  const [artists, setArtists] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    loadArtists();
  }, []);

  async function loadArtists() {
    const { data } = await supabase
      .from("artists")
      .select("*")
      .order("created_at", { ascending: false });

    setArtists(data || []);
  }

  async function createArtist() {
    if (!name) {
      alert("Artist name required");
      return;
    }

    const { error } = await supabase.from("artists").insert({
      name,
      country,
      status: "active",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setCountry("");
    loadArtists();
  }

  return (
    <main style={{ padding: 30, color: "white" }}>
      <h1>🎤 Artist Management</h1>

      <div style={{ marginTop: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Artist Name"
        />

        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country"
        />

        <button onClick={createArtist}>
          Add Artist
        </button>
      </div>

      <div style={{ marginTop: 30 }}>
        {artists.map((artist) => (
          <div key={artist.id}>
            <strong>{artist.name}</strong> — {artist.country}
          </div>
        ))}
      </div>
    </main>
  );
}