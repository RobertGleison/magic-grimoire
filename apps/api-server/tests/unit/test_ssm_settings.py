import os

import boto3
import pytest
from botocore.stub import Stubber

from app.core.config import load_ssm_parameters

_NAMES = ("GRIMOIRE_TEST_A", "GRIMOIRE_TEST_B", "GRIMOIRE_TEST_C")


@pytest.fixture(autouse=True)
def clean_env():
    for name in _NAMES:
        os.environ.pop(name, None)
    yield
    for name in _NAMES:
        os.environ.pop(name, None)


def _ssm():
    return boto3.client(
        "ssm", region_name="eu-north-1", aws_access_key_id="test", aws_secret_access_key="test"
    )


def test_loads_every_parameter_across_pages():
    client = _ssm()
    with Stubber(client) as stub:
        stub.add_response(
            "get_parameters_by_path",
            {"Parameters": [{"Name": "/app/prod/GRIMOIRE_TEST_A", "Value": "a"}], "NextToken": "t1"},
            {"Path": "/app/prod", "WithDecryption": True, "Recursive": False},
        )
        stub.add_response(
            "get_parameters_by_path",
            {"Parameters": [{"Name": "/app/prod/GRIMOIRE_TEST_B", "Value": "b"}]},
            {"Path": "/app/prod", "WithDecryption": True, "Recursive": False, "NextToken": "t1"},
        )
        load_ssm_parameters("/app/prod", client=client)

    assert os.environ["GRIMOIRE_TEST_A"] == "a"
    assert os.environ["GRIMOIRE_TEST_B"] == "b"


def test_existing_environment_wins():
    os.environ["GRIMOIRE_TEST_C"] = "from-env"
    client = _ssm()
    with Stubber(client) as stub:
        stub.add_response(
            "get_parameters_by_path",
            {"Parameters": [{"Name": "/app/prod/GRIMOIRE_TEST_C", "Value": "from-ssm"}]},
            {"Path": "/app/prod", "WithDecryption": True, "Recursive": False},
        )
        load_ssm_parameters("/app/prod", client=client)

    assert os.environ["GRIMOIRE_TEST_C"] == "from-env"


def test_empty_environment_variable_counts_as_unset():
    os.environ["GRIMOIRE_TEST_C"] = ""
    client = _ssm()
    with Stubber(client) as stub:
        stub.add_response(
            "get_parameters_by_path",
            {"Parameters": [{"Name": "/app/prod/GRIMOIRE_TEST_C", "Value": "from-ssm"}]},
            {"Path": "/app/prod", "WithDecryption": True, "Recursive": False},
        )
        load_ssm_parameters("/app/prod", client=client)

    assert os.environ["GRIMOIRE_TEST_C"] == "from-ssm"


def test_no_path_makes_no_call():
    client = _ssm()
    with Stubber(client):  # any call would raise: no responses queued
        load_ssm_parameters(None, client=client)
        load_ssm_parameters("", client=client)
