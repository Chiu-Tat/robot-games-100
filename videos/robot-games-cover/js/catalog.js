function game(id, name, category, motion, prop, speed, summary, extra) {
  return Object.assign(
    { id, name, category, motion, prop, speed, summary },
    extra
  );
}

const CATEGORIES = [
  { id: "track", name: "Track", scene: "track", tint: "#3ee0c5", keys: "running race" },
  { id: "jumps", name: "Jumps", scene: "runway", tint: "#8aa4ff", keys: "jumping leap" },
  { id: "throws", name: "Throws", scene: "circle", tint: "#ffb020", keys: "throwing" },
  { id: "court", name: "Court", scene: "wood", tint: "#ff7a45", keys: "ball indoor" },
  { id: "field", name: "Field", scene: "grass", tint: "#9be07a", keys: "ball outdoor" },
  { id: "racquet", name: "Racquet", scene: "hardcourt", tint: "#dff25a", keys: "racket ball" },
  { id: "precision", name: "Precision", scene: "lane", tint: "#f4f7ff", keys: "aim target" },
  { id: "combat", name: "Combat", scene: "ring", tint: "#ff5d8f", keys: "martial fight" },
  { id: "water", name: "Water", scene: "water", tint: "#3ec6ff", keys: "aquatic swim" },
  { id: "ice", name: "Snow & Ice", scene: "ice", tint: "#c6f4ff", keys: "winter snow ski" },
  { id: "wheels", name: "Wheels", scene: "road", tint: "#c9a6ff", keys: "bike cycle ride" },
  { id: "gym", name: "Gym & Skill", scene: "gym", tint: "#ffd1a4", keys: "gymnastics" },
];

const GAMES = [
  game("sprint", "100m Sprint", "track", "run", null, 2.35, "Explodes off the blocks and drives the straight with high metal knees.", { amp: 1.2, lean: 18, landmark: "blocks", placeX: 0.42 }),
  game("dash", "400m Dash", "track", "run", null, 2.05, "Holds a hard curve-pace, visor low, one lap and no mercy.", { amp: 1.05, lean: 14 }),
  game("marathon", "Marathon", "track", "run", null, 1.15, "Settles into a quiet running rhythm that could tick over for hours.", { amp: 0.72, lean: 8 }),
  game("hurdles", "Hurdles", "track", "hurdle", null, 1.45, "Sprints, then folds both legs over the barrier without breaking stride.", { landmark: "hurdle", placeX: 0.4 }),
  game("steeple", "Steeplechase", "track", "hurdle", null, 1.2, "Clears the barrier and reaches for the water pit on the other side.", { scene: "steeple", landmark: "hurdle", placeX: 0.38, amp: 1.05 }),
  game("relay", "Relay", "track", "run", "baton", 2.15, "Sprints the exchange, baton locked in the near hand.", { amp: 1.1, lean: 16 }),
  game("racewalk", "Race Walk", "track", "walk", null, 1.35, "A stiff, legal walk: one foot always trying to stay on the track.", { lean: 4 }),
  game("cross", "Cross Country", "track", "run", null, 1.35, "Runs the uneven trail with a longer stride and a lower shoulder.", { scene: "trail", amp: 0.9, lean: 16 }),

  game("longjump", "Long Jump", "jumps", "longjump", null, 0.72, "Sprints the runway and hangs in the air over the sand pit.", { scene: "pit", landmark: "pit", placeX: 0.38 }),
  game("highjump", "High Jump", "jumps", "highjump", null, 0.55, "Curves in, then arches a metal back over the bar.", { scene: "gym", landmark: "bar" }),
  game("triple", "Triple Jump", "jumps", "triple", null, 0.8, "Hop, step, and jump — three takeoffs before the pit.", { scene: "pit", landmark: "pit", placeX: 0.36 }),
  game("vault", "Pole Vault", "jumps", "vault", "pole", 0.62, "Plants the pole and swings upside-down over the bar.", { landmark: "bar", placeX: 0.4 }),
  game("tramp", "Trampoline", "jumps", "tramp", null, 0.95, "Bounces higher each touch, tucked tight at the top.", { scene: "gym", landmark: "tramp" }),
  game("parkour", "Parkour", "jumps", "parkour", null, 1.05, "Runs the roof line and tucks over a rail.", { scene: "city", landmark: "rail", placeX: 0.4 }),

  game("shot", "Shot Put", "throws", "shot", "shot", 0.5, "Coils in the circle and punches the heavy shot away.", { placeX: 0.42 }),
  game("discus", "Discus", "throws", "discus", "disc", 0.72, "Spins on the concrete and slings the disc flat.", { placeX: 0.46 }),
  game("javelin", "Javelin", "throws", "javelin", "javelin", 0.58, "A long approach, then the spear leaves the hand.", { scene: "runway", placeX: 0.38 }),
  game("hammer", "Hammer Throw", "throws", "hammer", "hammer", 0.64, "Winds the hammer on a wire, then lets the circle go.", { placeX: 0.48 }),

  game("basketball", "Basketball", "court", "dribble", "ball", 1.7, "Low dribble, then a rise toward the hoop.", { landmark: "hoop", placeX: 0.4 }),
  game("volleyball", "Volleyball", "court", "spike", "ball", 0.85, "Three steps and a swing through the ball above the net.", { landmark: "net", placeX: 0.4 }),
  game("beach", "Beach Volleyball", "court", "spike", "ball", 0.78, "Same spike, slower feet, sand under the boots.", { scene: "sand", landmark: "net", placeX: 0.4 }),
  game("handball", "Handball", "court", "throw", "ball", 0.9, "Jumps and slings a ball at a goal-sized target.", { landmark: "goal", placeX: 0.4 }),
  game("netball", "Netball", "court", "shoot", "ball", 0.62, "Plants both feet and lofts a shot at the ring.", { landmark: "hoop", placeX: 0.4 }),
  game("dodgeball", "Dodgeball", "court", "dodge", "ball", 1.15, "Leans out of a ball, then fires one back.", { scene: "gym" }),
  game("takraw", "Sepak Takraw", "court", "kick", "ball", 1.15, "A woven ball stays in the air off the instep.", { propScale: 0.72 }),
  game("spikeball", "Spikeball", "court", "spike", "ball", 1.25, "A small ball gets driven down at a round net.", { scene: "sand", propScale: 0.55, landmark: "roundnet" }),

  game("soccer", "Soccer", "field", "kick", "ball", 1.05, "Plants, swings, and sends the ball toward the goal.", { landmark: "goal", placeX: 0.38 }),
  game("football", "American Football", "field", "throw", "oval", 0.8, "Drops back and throws the oval downfield.", { placeX: 0.4, keys: "ball throw" }),
  game("rugby", "Rugby", "field", "carry", "oval", 1.45, "Tucks the ball and runs through contact.", { keys: "ball run" }),
  game("baseball", "Baseball", "field", "swing", "bat", 0.7, "Loads the bat and drives through the ball.", { landmark: "base", play: "ball", placeX: 0.42 }),
  game("softball", "Softball", "field", "swing", "bat", 0.62, "A flatter swing under a bigger ball.", { landmark: "base", play: "ball", playScale: 0.85, placeX: 0.42 }),
  game("cricket", "Cricket", "field", "swing", "bat", 0.55, "Guards the stumps, then drives the ball along the ground.", { landmark: "stumps", play: "ball", playScale: 0.6, amp: 0.8, placeX: 0.44 }),
  game("kickball", "Kickball", "field", "kick", "ball", 0.9, "A full-boot kick through a playground ball.", { playScale: 1.15 }),
  game("lacrosse", "Lacrosse", "field", "cradle", "lacrosse", 1.35, "Cradles the ball in the pocket and dodges upfield.", { landmark: "goal", play: "ball", playScale: 0.45, placeX: 0.4 }),
  game("fieldhockey", "Field Hockey", "field", "stick", "stick", 1.4, "Dribbles a small ball with the hook of the stick.", { play: "ball", playScale: 0.42, landmark: "goal", placeX: 0.4 }),
  game("ultimate", "Ultimate", "field", "frisbee", "frisbee", 0.85, "Pivots and flicks the disc to a cut.", { keys: "disc frisbee" }),

  game("tennis", "Tennis", "racquet", "racket", "racket", 0.95, "Split step, then a forehand through the ball.", { landmark: "net", play: "ball", playScale: 0.55 }),
  game("badminton", "Badminton", "racquet", "racket", "racket", 1.15, "A fast wrist and a shuttle that dies over the net.", { scene: "wood", landmark: "net", play: "shuttle", playScale: 0.7 }),
  game("tabletennis", "Table Tennis", "racquet", "racket", "racket", 1.45, "Compact strokes, a tiny ball, almost no backswing.", { scene: "table", landmark: "tablenet", play: "ball", playScale: 0.32, propScale: 0.65 }),
  game("squash", "Squash", "racquet", "racket", "racket", 1.2, "Retrieves off the back wall and drives the ball tight.", { scene: "wood", play: "ball", playScale: 0.4 }),
  game("pickleball", "Pickleball", "racquet", "racket", "racket", 1, "A softer swing and a ball full of holes.", { landmark: "net", play: "ball", playScale: 0.5, propScale: 0.8 }),
  game("racquetball", "Racquetball", "racquet", "racket", "racket", 1.25, "Takes the ball on the rise after the front wall.", { scene: "wood", play: "ball", playScale: 0.42 }),

  game("golf", "Golf", "precision", "golf", "club", 0.48, "A still pause, then the club sends the ball off the tee.", { scene: "green", landmark: "cup", play: "ball", playScale: 0.35, placeX: 0.4 }),
  game("bowling", "Bowling", "precision", "bowl", "ball", 0.52, "Four steps and a roll toward the pins.", { scene: "alley", landmark: "pins", placeX: 0.34 }),
  game("billiards", "Billiards", "precision", "cue", "cue", 0.42, "Bridges down and strokes the cue through the ball.", { scene: "table", play: "ball", playScale: 0.4 }),
  game("darts", "Darts", "precision", "darts", "dart", 0.48, "Aims, then the dart leaves for the board.", { scene: "dartwall", landmark: "dartboard", placeX: 0.36 }),
  game("archery", "Archery", "precision", "archery", "bow", 0.4, "Draws to the visor and looses an arrow.", { scene: "range", landmark: "target", placeX: 0.36 }),
  game("bocce", "Bocce", "precision", "bocce", "ball", 0.48, "A soft underhand toss toward the pallino.", { scene: "dirt", playScale: 0.8 }),
  game("croquet", "Croquet", "precision", "croquet", "mallet", 0.42, "A quiet mallet stroke through the hoop.", { scene: "green", landmark: "wicket", play: "ball", playScale: 0.55 }),
  game("cornhole", "Cornhole", "precision", "cornhole", "beanbag", 0.5, "Lobs a bag at the hole in the board.", { scene: "lawn", landmark: "board", placeX: 0.36 }),

  game("boxing", "Boxing", "combat", "box", null, 1.7, "Jab, cross, and a shoulder roll off the return."),
  game("kickboxing", "Kickboxing", "combat", "kickbox", null, 1.15, "Hands high, then a round kick through the target."),
  game("wrestling", "Wrestling", "combat", "grapple", null, 0.75, "Level change, hands out, looking for the tie."),
  game("judo", "Judo", "combat", "judo", null, 0.7, "Grips, turns, and fits in for the throw."),
  game("karate", "Karate", "combat", "karate", null, 1, "A straight punch from a long front stance."),
  game("taekwondo", "Taekwondo", "combat", "tkd", null, 1, "Chambers the knee and snaps a head-high kick."),
  game("fencing", "Fencing", "combat", "fence", "foil", 1.15, "Small steps, then a long lunge down the piste.", { propScale: 0.9 }),
  game("kendo", "Kendo", "combat", "kendo", "sword", 0.9, "Raises the shinai and cuts straight down."),
  game("sumo", "Sumo", "combat", "sumo", null, 0.62, "A wide stance, a stomp, and a charge."),
  game("capoeira", "Capoeira", "combat", "capoeira", null, 0.85, "Sways in the ginga, then a low spinning kick."),

  game("freestyle", "Freestyle", "water", "swim", null, 1.15, "Face in the water, arms alternating, a flutter kick."),
  game("backstroke", "Backstroke", "water", "backstroke", null, 0.95, "Visor to the ceiling, arms recovering over the water."),
  game("breaststroke", "Breaststroke", "water", "breast", null, 0.8, "Arms sweep out together and the legs whip as one."),
  game("butterfly", "Butterfly", "water", "fly", null, 0.85, "Both arms recover as the body dolphins through the water."),
  game("diving", "Platform Diving", "water", "dive", null, 0.42, "Bounces, pikes, and disappears into the pool.", { landmark: "platform", placeX: 0.42 }),
  game("waterpolo", "Water Polo", "water", "tread", "ball", 0.9, "Treads high and holds the ball up for the shot.", { landmark: "goal", placeX: 0.4 }),
  game("surfing", "Surfing", "water", "surf", null, 0.55, "Knees soft, arms out, riding the face of the wave."),
  game("rowing", "Rowing", "water", "row", "oar", 0.8, "Legs drive, back opens, oar handle comes in."),
  game("kayaking", "Kayaking", "water", "kayak", "paddle", 1, "A double blade plants left, then right."),
  game("sailing", "Sailing", "water", "sail", null, 0.35, "Stands in the hull and trims as the boat heels."),

  game("alpine", "Alpine Skiing", "ice", "ski", null, 0.75, "A low tuck and long skis carving the fall line.", { scene: "snow", lean: 30 }),
  game("xcski", "Cross-country Skiing", "ice", "xcski", null, 1.15, "Diagonal stride: skis and poles trading the work.", { scene: "snow" }),
  game("snowboard", "Snowboarding", "ice", "snowboard", null, 0.7, "Both boots locked sideways, riding one edge.", { scene: "snow" }),
  game("skijump", "Ski Jump", "ice", "skijump", null, 0.48, "Crouches the in-run, then flies with skis in a V.", { scene: "snow", landmark: "inrun", placeX: 0.4 }),
  game("figureskate", "Figure Skating", "ice", "spin", null, 0.55, "Glides into a spiral, free leg long behind."),
  game("speedskate", "Speed Skating", "ice", "skate", null, 1.85, "Deep lean, hands tucked, blades trading long pushes.", { vehicle: "skates", lean: 34 }),
  game("hockey", "Ice Hockey", "ice", "stick", "stick", 1.55, "Short strides and a puck on the blade.", { play: "puck", playScale: 0.7, landmark: "goal", placeX: 0.4, vehicle: "skates" }),
  game("curling", "Curling", "ice", "curl", "stone", 0.5, "Slides out of the hack and releases the stone.", { landmark: "house", placeX: 0.34 }),
  game("bobsled", "Bobsled", "ice", "bobsled", null, 0.4, "Sprints the start, then tucks into the sled."),
  game("biathlon", "Biathlon", "ice", "biathlon", "rifle", 0.7, "Skis the loop, then settles to aim.", { scene: "snow", landmark: "target", placeX: 0.4 }),

  game("cycling", "Road Cycling", "wheels", "cycle", null, 1.55, "Aero on the hoods, legs turning a smooth circle.", { vehicle: "bike", lean: 18 }),
  game("bmx", "BMX", "wheels", "cycle", null, 1.05, "A smaller bike, a higher pump, a trick over the lip.", { vehicle: "bmx", scene: "park", lean: 22 }),
  game("mtb", "Mountain Biking", "wheels", "cycle", null, 1.25, "Stays loose over the trail, elbows out.", { vehicle: "mtb", scene: "trail", lean: 20 }),
  game("skateboard", "Skateboarding", "wheels", "skateboard", null, 0.85, "Pushes, sets the feet, and pops an ollie.", { scene: "park" }),
  game("rollerskate", "Roller Skating", "wheels", "skate", null, 1.25, "A rink stride on four wheels, arms easy.", { vehicle: "rollers", scene: "rink", lean: 14 }),
  game("inline", "Inline Skating", "wheels", "skate", null, 1.65, "Long pushes on a single line of wheels.", { vehicle: "rollers", lean: 26 }),

  game("floor", "Floor Exercise", "gym", "floor", null, 0.7, "A run into a roundoff and a stuck landing."),
  game("beam", "Balance Beam", "gym", "beam", null, 0.48, "Walks the four-inch line with arms wide.", { landmark: "beam" }),
  game("rings", "Still Rings", "gym", "rings", null, 0.42, "Hangs, then holds a stiff support above the rings.", { landmark: "rings" }),
  game("pbars", "Parallel Bars", "gym", "pbars", null, 0.58, "Swings between the rails and regrasp at the top.", { landmark: "bars" }),
  game("pommel", "Pommel Horse", "gym", "pommel", null, 1.15, "Hands circle the pommels, legs swinging as one.", { landmark: "pommel" }),
  game("lifting", "Weightlifting", "gym", "lift", "bar", 0.45, "Pulls from the floor and catches the bar overhead."),
  game("climbing", "Sport Climbing", "gym", "climb", null, 0.5, "Reads the next hold and pushes off the feet.", { scene: "wall", landmark: "holds", placeX: 0.42 }),
  game("jumprope", "Jump Rope", "gym", "jumprope", "rope", 1.9, "Small hops while the rope ticks under the boots."),
  game("ribbon", "Rhythmic Ribbon", "gym", "ribbon", "ribbon", 0.75, "Draws snakes and spirals with the ribbon."),
  game("cheer", "Cheer", "gym", "cheer", null, 1.25, "Claps tight, then jumps into a high V."),
  game("breaking", "Breaking", "gym", "breaking", null, 0.9, "Toprock, then a freeze low on one hand."),
  game("yoga", "Yoga", "gym", "yoga", null, 0.28, "Moves from a long warrior into tree pose."),
  game("tug", "Tug of War", "gym", "tug", "rope", 0.48, "Leans back and hauls the rope hand over hand.", { placeX: 0.58 }),
  game("handstand", "Handstand", "gym", "handstand", null, 0.32, "Kicks up and holds the line from wrist to toe."),
];

function categoryById(id) {
  return CATEGORIES.find((category) => category.id === id) || CATEGORIES[0];
}

function sceneOf(game) {
  return game.scene || categoryById(game.category).scene;
}
