import pytest

from game_engine import GameEngine, LOCATIONS


def get_internal_game_data(engine: GameEngine):
    return engine.game_data


def test_given_multiple_investigations_when_investigating_then_rumors_are_unique():
    """Given an inquisitor who keeps investigating, when a rumor is uncovered at each location, then all rumor notes are unique until the pool is exhausted."""
    engine = GameEngine("Beast", "Investigator", seed=42)
    game_data = get_internal_game_data(engine)

    unique_notes = set()

    for location in LOCATIONS:
        game_data.player_location = location.id
        game_data.rumors_tokens[location.id] = True
        game_data.actions_remaining = 2

        response = engine.investigate()
        assert response["success"] is True

        latest_rumor = game_data.investigation["rumors"][-1]
        assert latest_rumor["note"] not in unique_notes
        unique_notes.add(latest_rumor["note"])


def test_given_learned_secrets_when_hunting_then_dice_match_secret_count():
    """Given four learned secrets, when the inquisitor hunts the beast, then four dice are rolled."""
    engine = GameEngine("Beast", "Hunter", seed=7)
    game_data = get_internal_game_data(engine)

    game_data.beast_location = game_data.player_location
    game_data.actions_remaining = 2
    game_data.investigation["secrets"] = [
        {"id": f"secret-{index}", "secret": f"Ancient Secret {index}", "category": "ward"}
        for index in range(4)
    ]

    result = engine.hunt_beast()

    assert result["success"] is True
    assert "dice_rolls" in result
    assert len(result["dice_rolls"]) == 4


def test_given_beast_two_steps_away_when_it_moves_then_it_advances_one_location():
    """Given the beast is two steps away, when it moves closer, then it advances exactly one location toward the inquisitor."""
    engine = GameEngine("Beast", "Tracker", seed=99)
    game_data = get_internal_game_data(engine)

    game_data.player_location = "IV"
    game_data.beast_location = "VIII"
    game_data.rumors_tokens["VIII"] = True
    game_data.beast_distance = engine._calculate_distance("VIII", "IV")

    engine._move_beast_closer()

    assert game_data.beast_location == "V"
    assert game_data.beast_distance == 1


