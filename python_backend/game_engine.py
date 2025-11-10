"""
The Eleventh Beast Game Engine
Python implementation of the game rules following gamerules.txt
"""

import random
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum

class GamePhase(Enum):
    BEAST_APPROACHES = "beast-approaches"
    TAKE_ACTIONS = "take-actions"
    HUNT = "hunt"
    GAME_ENDED = "game-ended"

@dataclass
class Location:
    id: str
    name: str
    x: float
    y: float

@dataclass
class Rumor:
    id: str
    location: str
    note: str
    category: str
    verified: bool = False
    is_false: bool = False
    is_learned: bool = False

@dataclass
class Secret:
    id: str
    secret: str
    category: str

@dataclass
class GameData:
    # Game setup
    beast_name: str
    inquisitor_name: str
    current_day: int
    current_month: str
    current_year: int
    seed: int
    
    # Player state
    player_location: str
    health: int = 100
    knowledge: int = 0
    wounds: int = 0
    
    # Beast state
    beast_location: Optional[str] = None
    beast_distance: Optional[int] = None
    
    # Investigation
    investigation: Dict = None
    wards: List[Dict] = None
    weapons: List[Dict] = None
    
    # Game state
    rumors_tokens: Dict[str, bool] = None
    game_ended: bool = False
    victorious: bool = False
    game_phase: GamePhase = GamePhase.BEAST_APPROACHES
    actions_remaining: int = 2
    current_round: int = 1
    
    # Game statistics
    start_time: int = 0
    days_elapsed: int = 0
    investigations_completed: int = 0
    equipment_collected: int = 0

# London map locations from gamerules.txt
LOCATIONS = [
    Location("I", "The Royal Exchange", 50, 20),
    Location("II", "All-Hallows-The-Great", 30, 40),
    Location("III", "Billingsgate Dock", 70, 35),
    Location("IV", "London Bridge", 60, 55),
    Location("V", "St. Thomas' Hospital", 40, 65),
    Location("VI", "Coxes Wharf", 75, 70),
    Location("VII", "Marshalsea Prison", 35, 85),
    Location("VIII", "Burying Ground", 55, 90),
]

# Location connections based on white line connections in map
LOCATION_CONNECTIONS = {
    "I": ["II", "III"],      # Royal Exchange connects to All-Hallows and Billingsgate
    "II": ["I", "IV", "V"],   # All-Hallows connects to Royal Exchange, London Bridge, St. Thomas
    "III": ["I", "IV"],       # Billingsgate connects to Royal Exchange, London Bridge
    "IV": ["II", "III", "V", "VI"], # London Bridge central hub
    "V": ["II", "IV", "VII", "VIII"], # St. Thomas' Hospital
    "VI": ["IV", "VIII"],     # Coxes Wharf
    "VII": ["V", "VIII"],     # Marshalsea Prison
    "VIII": ["V", "VI", "VII"], # Burying Ground
}

# Rumors pool for investigation (with categories)
RUMORS = [
    {"note": "The creature moves only at night...", "category": "ward"},
    {"note": "It feeds on the sins of men...", "category": "weapon"},
    {"note": "A red cross marks its true name...", "category": "ward"},
    {"note": "It fears running water and iron...", "category": "weapon"},
    {"note": "The beast was summoned by dark rituals...", "category": "ward"},
    {"note": "Its screams can shatter the mind...", "category": "weapon"},
    {"note": "It leaves no trace, only destruction...", "category": "ward"},
    {"note": "Some say it is immortal...", "category": "weapon"},
]

class GameEngine:
    def __init__(self, beast_name: str, inquisitor_name: str, seed: Optional[int] = None):
        # Set seed for reproducible randomness
        if seed is None:
            seed = int(datetime.now().timestamp())
        random.seed(seed)
        
        # Initialize game data
        self.game_data = GameData(
            beast_name=beast_name,
            inquisitor_name=inquisitor_name,
            current_day=13,
            current_month="May",
            current_year=1746,
            seed=seed,
            player_location="II",  # Start at All-Hallows-The-Great as per rules
            investigation={
                "rumors": [],
                "secrets": [],
                "notes": []
            },
            wards=[],
            weapons=[],
            rumors_tokens={},
            start_time=int(datetime.now().timestamp() * 1000),
        )
        
        # Add initial log entry
        self.game_log = [{
            "id": "1",
            "message": f"{inquisitor_name} begins their investigation at All-Hallows-The-Great on May 13, 1746.",
            "timestamp": int(datetime.now().timestamp() * 1000)
        }]
        
        # Execute initial beast approaches phase
        self._execute_beast_approaches_phase()
    
    def _add_to_log(self, message: str):
        """Add a message to the game log"""
        log_entry = {
            "id": str(int(datetime.now().timestamp() * 1000)),
            "message": f"[Round {self.game_data.current_round}] {message}",
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        self.game_log.append(log_entry)
    
    def _execute_beast_approaches_phase(self):
        """Execute Phase I: The Beast Approaches (as per gamerules.txt)"""
        # Step 1: Roll 1d8 and find location
        roll_1d8 = random.randint(1, 8)
        roman_numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]
        target_location = roman_numerals[roll_1d8 - 1]
        target_location_name = next(loc.name for loc in LOCATIONS if loc.id == target_location)
        
        self._add_to_log(
            f"THE BEAST APPROACHES - A whisper on the wind... The {self.game_data.beast_name} stirs at {target_location_name} (Location {target_location})."
        )
        
        beast_already_on_location = self.game_data.beast_location == target_location
        beast_is_on_map = self.game_data.beast_location is not None
        has_rumor_token = target_location in self.game_data.rumors_tokens

        # Step 2 & 3: Check if location has rumor token
        if has_rumor_token:
            if not beast_is_on_map:
                # Beast arrives at location with rumor token
                self.game_data.beast_location = target_location
                self.game_data.beast_distance = self._calculate_distance(self.game_data.player_location, target_location)
                self._add_to_log(
                    f"The Beast has ARRIVED! {self.game_data.beast_name} materializes at {target_location_name} (Location {target_location})!"
                )
            elif not beast_already_on_location:
                self._add_to_log(
                    f"The rumor at {target_location_name} (Location {target_location}) intensifies, but the Beast hunts elsewhere."
                )
        else:
            # Place rumor token at location
            self.game_data.rumors_tokens[target_location] = True
            self._add_to_log(
                f"A Rumor Token appears at {target_location_name} (Location {target_location})."
            )

            if not beast_is_on_map:
                return  # Don't move to step 4 if beast not on map
        
        if self.game_data.beast_location == target_location and self.game_data.player_location == target_location:
            self._add_to_log(
                f"SURPRISE! The Beast is here with you at {target_location_name} (Location {target_location})! A hunt is triggered!"
            )
            self.game_phase = GamePhase.HUNT
            return
        
        # Step 4 & 5: If Beast is on map, roll 1d6 for movement
        if self.game_data.beast_location:
            roll_1d6 = random.randint(1, 6)
            if roll_1d6 >= 5:  # 5 or 6 moves beast closer
                self._add_to_log("The Beast moves closer... It approaches your location!")
                
                # Calculate new distance
                old_distance = self.game_data.beast_distance
                new_distance = self._calculate_distance(self.game_data.player_location, target_location)
                
                # Move beast one location closer
                self._move_beast_closer()
                new_distance_after_move = self._calculate_distance(self.game_data.player_location, self.game_data.beast_location)
                
                # Step 5: Check if same location (surprise hunt)
                if self.game_data.player_location == self.game_data.beast_location:
                    self._add_to_log(
                        f"SURPRISE! The Beast is here with you at {target_location_name} (Location {target_location})! A hunt is triggered!"
                    )
                    self.game_phase = GamePhase.HUNT
                    return
    
    def _move_beast_closer(self):
        """Move the beast one location closer to the player"""
        if not self.game_data.beast_location:
            return
            
        current_distance = self.game_data.beast_distance
        if current_distance is None or current_distance <= 1:
            return
        
        # Find a path from beast to player and move one step
        path = self._find_path(self.game_data.beast_location, self.game_data.player_location)
        if not path:
            return

        if len(path) == 2:
            # Beast moves onto player's location
            self.game_data.beast_location = self.game_data.player_location
            self.game_data.beast_distance = 0
            self._add_to_log("The Beast lunges onto your location!")
            self.game_phase = GamePhase.HUNT
            return

        if len(path) > 2:
            self.game_data.beast_location = path[1]
            self.game_data.beast_distance = len(path) - 2
    
    def _calculate_distance(self, from_location: str, to_location: str) -> int:
        """Calculate shortest distance between two locations"""
        if from_location == to_location:
            return 0
        
        path = self._find_path(from_location, to_location)
        return len(path) - 1 if path else -1
    
    def _find_path(self, from_location: str, to_location: str) -> List[str]:
        """Find shortest path using BFS"""
        if from_location == to_location:
            return [from_location]
        
        queue = [(from_location, [from_location])]
        visited = set()
        
        while queue:
            current_location, path = queue.pop(0)
            visited.add(current_location)
            
            if current_location == to_location:
                return path
            
            for neighbor in LOCATION_CONNECTIONS.get(current_location, []):
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))
        
        return []
    
    def move_player(self, target_location: str) -> Dict:
        """Execute MOVE action - move player to adjacent location"""
        # Check if location is adjacent
        adjacent_locations = LOCATION_CONNECTIONS.get(self.game_data.player_location, [])
        if target_location not in adjacent_locations:
            return {
                "success": False,
                "message": f"Cannot move to {target_location} from {self.game_data.player_location}. Must be adjacent location.",
                "game_data": self._get_serializable_game_data()
            }
        
        # Get location name
        location_name = next((loc.name for loc in LOCATIONS if loc.id == target_location), "Unknown")
        
        # Move player
        old_location = self.game_data.player_location
        self.game_data.player_location = target_location
        
        self._add_to_log(f"{self.game_data.inquisitor_name} moves to {location_name} (Location {target_location}).")
        
        # Check for surprise hunt
        if self.game_data.beast_location == target_location:
            self._add_to_log(
                f"SURPRISE! {self.game_data.beast_name} is here at {location_name} (Location {target_location})! A hunt is triggered!"
            )
            self.game_phase = GamePhase.HUNT
        
        return {
            "success": True,
            "message": f"Moved to {location_name}",
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log
        }
    
    def investigate(self) -> Dict:
        """Execute INVESTIGATE action"""
        if self.game_data.actions_remaining <= 0:
            return {
                "success": False,
                "message": "No actions remaining",
                "game_data": self._get_serializable_game_data()
            }
        
        if self.game_data.player_location not in self.game_data.rumors_tokens:
            return {
                "success": False,
                "message": "No Rumor Token at this location to investigate!",
                "game_data": self._get_serializable_game_data()
            }
        
        # Remove rumor token
        del self.game_data.rumors_tokens[self.game_data.player_location]
        
        # Get location name
        location_name = next((loc.name for loc in LOCATIONS if loc.id == self.game_data.player_location), "Unknown")
        
        # Generate new rumor ensuring uniqueness until all rumors are used
        existing_notes = {rumor["note"] for rumor in self.game_data.investigation["rumors"]}
        available_rumors = [rumor for rumor in RUMORS if rumor["note"] not in existing_notes]
        selected_rumor = random.choice(available_rumors or RUMORS)
        new_rumor = Rumor(
            id=str(int(datetime.now().timestamp() * 1000)),
            location=self.game_data.player_location,
            note=selected_rumor["note"],
            category=selected_rumor["category"]
        )
        
        # Add to investigation
        self.game_data.investigation["rumors"].append(asdict(new_rumor))
        
        self._add_to_log(
            f"{self.game_data.inquisitor_name} investigates at {location_name} (Location {self.game_data.player_location}) and uncovers a rumor: \"{selected_rumor['note']}\""
        )
        
        return {
            "success": True,
            "message": f"Investigation complete. New rumor added.",
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log
        }
    
    def verify_rumors(self) -> Dict:
        """Execute VERIFY action - only at All-Hallows-The-Great (II)"""
        if self.game_data.player_location != "II":
            return {
                "success": False,
                "message": "You can only verify rumors at All-Hallows-The-Great (Location II)!",
                "game_data": self._get_serializable_game_data()
            }
        
        if self.game_data.actions_remaining <= 0:
            return {
                "success": False,
                "message": "No actions remaining",
                "game_data": self._get_serializable_game_data()
            }
        
        unverified_rumors = [r for r in self.game_data.investigation["rumors"] if not r["verified"]]
        
        if not unverified_rumors:
            return {
                "success": False,
                "message": "You have no unverified rumors to verify!",
                "game_data": self._get_serializable_game_data()
            }
        
        false_count = 0
        learned_count = 0
        updated_rumors = self.game_data.investigation["rumors"].copy()
        
        for rumor in updated_rumors:
            if rumor["verified"]:
                continue
            
            roll_1d6 = random.randint(1, 6)
            
            if roll_1d6 >= 5:  # 5-6: false rumor
                false_count += 1
                rumor["verified"] = True
                rumor["is_false"] = True
                self._add_to_log(f'Rumor verification failed: "{rumor["note"]}" is marked as a false rumor.')
            else:  # 1-4: learned secret
                learned_count += 1
                rumor["verified"] = True
                rumor["is_learned"] = True
                self._add_to_log(f'Rumor verified as truth: "{rumor["note"]}" becomes a Learned Secret and provides insight into the Beast.')
        
        # Add new secrets
        new_secrets = []
        for rumor in updated_rumors:
            if (rumor.get("is_learned") and 
                not any(s["id"] == rumor["id"] for s in self.game_data.investigation["secrets"])):

                new_secret = Secret(
                    id=rumor["id"],
                    secret=rumor["note"],
                    category=rumor["category"]
                )
                new_secrets.append(asdict(new_secret))
                
                if rumor["category"] == "ward" and not any(w["id"] == rumor["id"] for w in self.game_data.wards):
                    self.game_data.wards.append({"id": rumor["id"], "name": rumor["note"]})
                if rumor["category"] == "weapon" and not any(w["id"] == rumor["id"] for w in self.game_data.weapons):
                    self.game_data.weapons.append({"id": rumor["id"], "name": rumor["note"]})
        
        self.game_data.investigation["rumors"] = updated_rumors
        self.game_data.investigation["secrets"].extend(new_secrets)
        self.game_data.equipment_collected = len(self.game_data.wards) + len(self.game_data.weapons)
        
        self._add_to_log(
            f"{self.game_data.inquisitor_name} completes verification at All-Hallows-The-Great. {learned_count} truth(s) learned, {false_count} false rumor(s) dismissed."
        )
        
        return {
            "success": True,
            "message": f"Verification complete. {learned_count} truths learned, {false_count} false rumors dismissed.",
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log
        }
    
    def hunt_beast(self) -> Dict:
        """Execute HUNT action"""
        if self.game_data.beast_location != self.game_data.player_location:
            return {
                "success": False,
                "message": "You must be in the same location as the Beast to hunt!",
                "game_data": self._get_serializable_game_data()
            }
        
        if self.game_data.actions_remaining <= 0:
            return {
                "success": False,
                "message": "No actions remaining",
                "game_data": self._get_serializable_game_data()
            }
        
        # Calculate dice for hunt (1d6 for each Ward/Weapon, max 5d6)
        learned_secrets = self.game_data.investigation["secrets"]
        dice_count = min(5, len(learned_secrets))
        
        if dice_count == 0:
            self.game_data.wounds += 1
            self._add_to_log("You have no dice for the hunt! You take 1 wound and the Beast survives.")
            
            if self.game_data.wounds >= 3:
                self._end_game(False)
                
            return {
                "success": True,
                "message": "Hunt failed. You take 1 wound with no dice.",
                "game_data": self._get_serializable_game_data(),
                "game_log": self.game_log
            }
        
        # Roll dice and use lowest value
        dice_rolls = [random.randint(1, 6) for _ in range(dice_count)]
        lowest_roll = min(dice_rolls)
        
        outcome = ""
        if lowest_roll <= 2:  # 1-2: slay beast
            self._add_to_log(f"HUNT SUCCESS! {self.game_data.inquisitor_name} has slain the {self.game_data.beast_name}!")
            self._end_game(True)
            outcome = "Victory! Beast slain!"
        elif lowest_roll <= 4:  # 3-4: beast survives, 1 wound
            self.game_data.wounds += 1
            self._add_to_log(f"The Beast survives! {self.game_data.inquisitor_name} takes 1 wound.")
            outcome = "Beast survives. You take 1 wound."
            
            if self.game_data.wounds >= 3:
                self._end_game(False)
        else:  # 5-6: beast unharmed, 2 wounds
            self.game_data.wounds += 2
            self._add_to_log(f"The Beast is unharmed! {self.game_data.inquisitor_name} takes 2 wounds.")
            outcome = "Beast unharmed. You take 2 wounds."
            
            if self.game_data.wounds >= 3:
                self._end_game(False)
        
        return {
            "success": True,
            "message": f"Hunt complete. {outcome}",
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log,
            "dice_rolls": dice_rolls,
            "lowest_roll": lowest_roll
        }
    
    def complete_action(self) -> Dict:
        """Complete an action and check if all actions are used"""
        self.game_data.actions_remaining -= 1
        
        if self.game_data.actions_remaining <= 0:
            return self._advance_day()
        
        return {
            "success": True,
            "message": f"Actions remaining: {self.game_data.actions_remaining}",
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log
        }
    
    def _advance_day(self) -> Dict:
        """Advance to the next day and start new round"""
        self._add_to_log("All actions for this turn have been used. Proceeding to The Beast Approaches phase...")
        self._add_to_log(f"[Round {self.game_data.current_round}] Day {self.game_data.current_day} of {self.game_data.current_month}. The round has ended.")
        
        # Advance day
        self.game_data.current_day += 1
        if self.game_data.current_day > 31:
            self.game_data.current_day = 1
            months = ["May", "June", "July", "August", "September", "October", "November", "December"]
            current_index = months.index(self.game_data.current_month)
            self.game_data.current_month = months[(current_index + 1) % len(months)]
        
        self.game_data.current_round += 1
        self.game_data.days_elapsed += 1
        self.game_data.actions_remaining = 2
        self.game_phase = GamePhase.BEAST_APPROACHES
        
        self._add_to_log(f"[Round {self.game_data.current_round}] Day {self.game_data.current_day} of {self.game_data.current_month}. The investigation continues...")
        
        # Execute beast approaches phase for new round
        self._execute_beast_approaches_phase()
        
        # Auto-transition to actions phase
        self.game_phase = GamePhase.TAKE_ACTIONS
        
        return {
            "success": True,
            "message": "New day begins! Beast approaches phase completed.",
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log
        }
    
    def _end_game(self, victory: bool):
        """End the game with victory or defeat"""
        self.game_data.game_ended = True
        self.game_data.victorious = victory
        self.game_phase = GamePhase.GAME_ENDED
        
        if victory:
            self._add_to_log(f"VICTORY! {self.game_data.inquisitor_name} has defeated {self.game_data.beast_name}!")
        else:
            self._add_to_log(f"DEFEAT! {self.game_data.inquisitor_name} has fallen in combat.")
    
    def _get_serializable_game_data(self) -> Dict:
        """Convert game data to serializable format for JSON response"""
        game_data_dict = asdict(self.game_data)
        game_data_dict["game_phase"] = self.game_phase.value
        return game_data_dict
    
    def get_game_state(self) -> Dict:
        """Get current game state"""
        return {
            "success": True,
            "game_data": self._get_serializable_game_data(),
            "game_log": self.game_log,
            "locations": [asdict(loc) for loc in LOCATIONS],
            "location_connections": LOCATION_CONNECTIONS
        }

# Game session management
game_sessions: Dict[str, GameEngine] = {}

def create_game(beast_name: str, inquisitor_name: str, seed: Optional[int] = None) -> str:
    """Create a new game session and return session ID"""
    session_id = str(int(datetime.now().timestamp() * 1000))
    game_sessions[session_id] = GameEngine(beast_name, inquisitor_name, seed)
    return session_id

def get_game(session_id: str) -> Optional[GameEngine]:
    """Get game engine for session ID"""
    return game_sessions.get(session_id)